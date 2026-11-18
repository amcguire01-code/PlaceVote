// PlaceVote engine: the maths behind the demo, with no page code in it,
// so it can be tested on its own (see tests/test_engine.js).
//
// Pipeline (after the pol.is method):
//   votes matrix -> fill gaps with column means -> PCA to 2D
//   -> k-means for k = 2..4, keep the k with the best silhouette
//   -> per-group agree/disagree counts -> consensus, divisive, distinctive statements
// Plus the offline "consolidation" step that decides whether a new map
// contribution joins an existing statement or becomes a new one.

var PV_ENGINE = (function () {
  "use strict";

  // ---------- random numbers (seeded, so the demo is the same every time) ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = 1 - r(), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------- simulated residents ----------
  // Returns { votes: [[1|-1|0|null, ...], ...], truth: [groupIndex, ...] }
  function simulate(spec, seed) {
    var r = rng(seed || 7), votes = [], truth = [];
    spec.forEach(function (g, gi) {
      for (var i = 0; i < g.n; i++) {
        var personal = gauss(r) * 0.15; // general mood: some people agree with more things
        var row = g.lean.map(function (lean) {
          if (r() < 0.22) return null; // didn't see / skipped this statement
          var x = lean + personal + gauss(r) * 0.38;
          return x > 0.2 ? 1 : x < -0.2 ? -1 : 0;
        });
        votes.push(row);
        truth.push(gi);
      }
    });
    return { votes: votes, truth: truth };
  }

  // ---------- PCA ----------
  function pca(votes) {
    var n = votes.length, m = votes[0].length, means = [], j, i;
    for (j = 0; j < m; j++) {
      var s = 0, c = 0;
      for (i = 0; i < n; i++) if (votes[i][j] !== null) { s += votes[i][j]; c++; }
      means.push(c ? s / c : 0);
    }
    var X = votes.map(function (row) {
      return row.map(function (v, j) { return v === null ? 0 : v - means[j]; });
    });
    var C = [];
    for (i = 0; i < m; i++) {
      C.push([]);
      for (j = 0; j < m; j++) {
        var s2 = 0;
        for (var k = 0; k < n; k++) s2 += X[k][i] * X[k][j];
        C[i].push(s2 / Math.max(1, n - 1));
      }
    }
    var comps = [], vals = [];
    for (var pc = 0; pc < 2; pc++) {
      var v = []; for (j = 0; j < m; j++) v.push(1 + j * 0.01);
      var lambda = 0;
      for (var it = 0; it < 300; it++) {
        var w = C.map(function (row) { return row.reduce(function (a, c, j2) { return a + c * v[j2]; }, 0); });
        var norm = Math.sqrt(w.reduce(function (a, b) { return a + b * b; }, 0)) || 1;
        lambda = norm;
        v = w.map(function (x) { return x / norm; });
      }
      comps.push(v); vals.push(lambda);
      // deflate
      for (i = 0; i < m; i++) for (j = 0; j < m; j++) C[i][j] -= lambda * v[i] * v[j];
    }
    var model = { means: means, comps: comps, eig: vals, m: m };
    model.points = votes.map(function (row) { return project(model, row); });
    return model;
  }

  // Project one participant. Like pol.is, people who voted on few statements
  // are scaled out so they don't all bunch up in the middle.
  function project(model, row) {
    var seen = 0;
    var x = row.map(function (v, j) { if (v !== null && v !== undefined) { seen++; return v - model.means[j]; } return 0; });
    var scale = seen ? Math.sqrt(model.m / seen) : 0;
    return model.comps.map(function (c) {
      return scale * c.reduce(function (a, cj, j) { return a + cj * x[j]; }, 0);
    });
  }

  // ---------- k-means + silhouette ----------
  function dist2(a, b) { return (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]); }

  function kmeans(pts, k, seed) {
    var r = rng(seed || 11), cents = [pts[Math.floor(r() * pts.length)].slice()];
    while (cents.length < k) { // k-means++ start
      var d = pts.map(function (p) { return Math.min.apply(null, cents.map(function (c) { return dist2(p, c); })); });
      var tot = d.reduce(function (a, b) { return a + b; }, 0), pick = r() * tot, idx = 0;
      while (idx < d.length - 1 && (pick -= d[idx]) > 0) idx++;
      cents.push(pts[idx].slice());
    }
    var labels = [];
    for (var it = 0; it < 100; it++) {
      var changed = false;
      pts.forEach(function (p, i) {
        var best = 0, bd = Infinity;
        cents.forEach(function (c, ci) { var dd = dist2(p, c); if (dd < bd) { bd = dd; best = ci; } });
        if (labels[i] !== best) { labels[i] = best; changed = true; }
      });
      cents = cents.map(function (c, ci) {
        var sx = 0, sy = 0, n = 0;
        pts.forEach(function (p, i) { if (labels[i] === ci) { sx += p[0]; sy += p[1]; n++; } });
        return n ? [sx / n, sy / n] : c;
      });
      if (!changed) break;
    }
    return { labels: labels, cents: cents };
  }

  function silhouette(pts, labels, k) {
    var total = 0;
    pts.forEach(function (p, i) {
      var sums = [], counts = [];
      for (var c = 0; c < k; c++) { sums.push(0); counts.push(0); }
      pts.forEach(function (q, j) { if (i !== j) { sums[labels[j]] += Math.sqrt(dist2(p, q)); counts[labels[j]]++; } });
      var own = labels[i], a = counts[own] ? sums[own] / counts[own] : 0, b = Infinity;
      for (c = 0; c < k; c++) if (c !== own && counts[c]) b = Math.min(b, sums[c] / counts[c]);
      total += (b === Infinity || Math.max(a, b) === 0) ? 0 : (b - a) / Math.max(a, b);
    });
    return total / pts.length;
  }

  function cluster(pts) {
    var best = null;
    for (var k = 2; k <= 4; k++) {
      var run = kmeans(pts, k, 11 + k), s = silhouette(pts, run.labels, k);
      if (!best || s > best.score + 0.02) best = { k: k, labels: run.labels, cents: run.cents, score: s };
    }
    return relabel(best, pts);
  }
  // Name groups A, B, C... from biggest to smallest so labels are stable.
  function relabel(res, pts) {
    var sizes = res.cents.map(function (_, ci) { return { ci: ci, n: res.labels.filter(function (l) { return l === ci; }).length }; });
    sizes.sort(function (a, b) { return b.n - a.n; });
    var map = {}; sizes.forEach(function (s, i) { map[s.ci] = i; });
    return {
      k: res.k, score: res.score,
      labels: res.labels.map(function (l) { return map[l]; }),
      cents: sizes.map(function (s) { return res.cents[s.ci]; }),
      sizes: sizes.map(function (s) { return s.n; })
    };
  }

  // ---------- group statistics ----------
  function stats(votes, labels, k) {
    var m = votes[0].length, out = [];
    for (var j = 0; j < m; j++) {
      var groups = [], all = { a: 0, d: 0, p: 0 };
      for (var g = 0; g < k; g++) groups.push({ a: 0, d: 0, p: 0 });
      votes.forEach(function (row, i) {
        var v = row[j]; if (v === null) return;
        var key = v === 1 ? "a" : v === -1 ? "d" : "p";
        groups[labels[i]][key]++; all[key]++;
      });
      groups.concat([all]).forEach(function (c) {
        c.seen = c.a + c.d + c.p;
        c.pa = (c.a + 1) / (c.seen + 2); // smoothed agree rate, as in pol.is
        c.pd = (c.d + 1) / (c.seen + 2);
      });
      // Group-informed consensus: high only if EVERY group tends to agree.
      var gic = groups.reduce(function (acc, c) { return acc * c.pa; }, 1);
      var gicD = groups.reduce(function (acc, c) { return acc * c.pd; }, 1);
      var pas = groups.map(function (c) { return c.pa; });
      var spread = Math.max.apply(null, pas) - Math.min.apply(null, pas);
      out.push({ index: j, groups: groups, all: all, gic: gic, gicD: gicD, spread: spread });
    }
    return out;
  }

  // What makes each group distinctive: agree (or disagree) much more than everyone else.
  function distinctive(votes, labels, k, perGroup) {
    var res = [];
    for (var g = 0; g < k; g++) {
      var items = [];
      for (var j = 0; j < votes[0].length; j++) {
        var inG = { a: 0, d: 0, s: 0 }, out = { a: 0, d: 0, s: 0 };
        votes.forEach(function (row, i) {
          var v = row[j]; if (v === null) return;
          var t = labels[i] === g ? inG : out;
          t.s++; if (v === 1) t.a++; if (v === -1) t.d++;
        });
        var pa = (inG.a + 1) / (inG.s + 2), pd = (inG.d + 1) / (inG.s + 2);
        var oa = (out.a + 1) / (out.s + 2), od = (out.d + 1) / (out.s + 2);
        var ra = pa / oa, rd = pd / od;
        if (pa > 0.5 && ra > 1.2) items.push({ index: j, dir: 1, p: pa, ratio: ra });
        else if (pd > 0.5 && rd > 1.2) items.push({ index: j, dir: -1, p: pd, ratio: rd });
      }
      items.sort(function (a, b) { return b.ratio * b.p - a.ratio * a.p; });
      res.push(items.slice(0, perGroup || 3));
    }
    return res;
  }

  function nearestGroup(point, cents) {
    var best = 0, bd = Infinity;
    cents.forEach(function (c, i) { var d = dist2(point, c); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  function analyse(votes) {
    var model = pca(votes), cl = cluster(model.points);
    var st = stats(votes, cl.labels, cl.k);
    var consensus = st.filter(function (s) { return s.groups.every(function (g) { return g.pa > 0.6; }); })
      .sort(function (a, b) { return b.gic - a.gic; });
    var divisive = st.filter(function (s) { return s.spread > 0.35; })
      .sort(function (a, b) { return b.spread - a.spread; });
    return {
      model: model, k: cl.k, labels: cl.labels, cents: cl.cents, sizes: cl.sizes, silhouette: cl.score,
      stats: st, consensus: consensus, divisive: divisive,
      distinctive: distinctive(votes, cl.labels, cl.k, 3)
    };
  }

  // ---------- consolidation of new map contributions (offline version) ----------
  var STOP = "a an the and or but to of in on at for with from by is are was be been it its this that these those i we you they my our your their me us there here as so if not no do does did have has had will would should could can just very too really please need needs want more some any all get got put make let near around next".split(" ");
  var SYN = {
    car: "traffic", cars: "traffic", vehicle: "traffic", driving: "traffic", drivers: "traffic", "rat": "traffic",
    bike: "cycle", bikes: "cycle", cycling: "cycle", cyclist: "cycle", cyclists: "cycle",
    light: "lighting", lights: "lighting", lit: "lighting", dark: "lighting", streetlight: "lighting", streetlights: "lighting",
    tree: "trees", planting: "trees", plant: "trees",
    shop: "shops", shopping: "shops", store: "shops", stores: "shops", units: "shops", unit: "shops",
    kids: "young", teenagers: "young", teens: "young", youth: "young", children: "young",
    homes: "housing", houses: "housing", flats: "housing", home: "housing",
    doctor: "gp", doctors: "gp", surgery: "gp", appointment: "gp", appointments: "gp",
    park: "green", garden: "green", gardens: "green", allotment: "green", allotments: "green",
    speed: "speeding", speeds: "speeding", fast: "speeding", "20mph": "speeding",
    unsafe: "safety", safe: "safety", scary: "safety", crime: "safety", cctv: "safety", cameras: "safety",
    canal: "towpath", path: "towpath"
  };
  function tokens(text) {
    return (text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(function (w) {
      return w.length > 1 && STOP.indexOf(w) < 0;
    }).map(function (w) {
      w = SYN[w] || w;
      if (w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
      return w;
    });
  }
  function bag(list) { var b = {}; list.forEach(function (w) { b[w] = (b[w] || 0) + 1; }); return b; }
  function cosine(a, b) {
    var dot = 0, na = 0, nb = 0, k;
    for (k in a) { na += a[k] * a[k]; if (b[k]) dot += a[k] * b[k]; }
    for (k in b) nb += b[k] * b[k];
    return na && nb ? dot / Math.sqrt(na * nb) : 0;
  }

  // statements: [{id, x, y, text, sources:[text...]}]
  // Returns ranked matches and a decision: merge into best match, or create a new statement.
  function consolidate(contrib, statements) {
    var cb = bag(tokens(contrib.text));
    var ranked = statements.map(function (s) {
      var sb = bag(tokens([s.text].concat(s.sources || []).join(" ")));
      var text = cosine(cb, sb);
      var d = Math.sqrt((s.x - contrib.x) * (s.x - contrib.x) + (s.y - contrib.y) * (s.y - contrib.y));
      var near = Math.exp(-d / 140);
      return { id: s.id, text: text, near: near, score: 0.65 * text + 0.35 * near };
    }).sort(function (a, b) { return b.score - a.score; });
    var top = ranked[0];
    var merge = top && top.text >= 0.2 && top.score >= 0.32;
    return { action: merge ? "merge" : "new", match: top, ranked: ranked.slice(0, 3) };
  }

  // Offline stand-in for the AI rewrite: strip chatty openings, tidy capitals and full stop.
  function tidy(text) {
    var t = (text || "").trim().replace(/\s+/g, " ");
    t = t.replace(/^(i think|i reckon|i feel|i'd like|i would like|we need to|we need|we should|please|can we|could we|it would be good to|there should be|why not|how about|someone should)\b[ ,:-]*/i, "");
    if (!t) return t;
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (!/[.!?]$/.test(t)) t += ".";
    return t.replace(/!+$/, ".");
  }

  // Light moderation for the demo: length, shouting, obvious abuse, personal details.
  var BLOCK = ["idiot", "scum", "stupid", "hate", "f***", "shit", "fuck", "bastard"];
  function moderate(text) {
    var t = (text || "").trim();
    if (t.length < 12) return "Add a little more detail (at least a short sentence).";
    if (t.length > 220) return "Keep it under 220 characters so others can read and vote on it quickly.";
    var lower = t.toLowerCase();
    for (var i = 0; i < BLOCK.length; i++) if (lower.indexOf(BLOCK[i]) >= 0) return "Please rephrase without insults or swearing.";
    if (/\b\d{1,3}\s+[a-z]+\s+(street|road|lane|avenue|close|drive)\b/i.test(t)) return "Please don't include house numbers or anyone's address.";
    if (/@|\b07\d{3}\s?\d{6}\b/.test(t)) return "Please don't include contact details.";
    var letters = t.replace(/[^A-Za-z]/g, "");
    if (letters.length > 15 && letters === letters.toUpperCase()) return "Please don't write in all capitals.";
    return null;
  }

  return {
    rng: rng, simulate: simulate, pca: pca, project: project, kmeans: kmeans, silhouette: silhouette,
    cluster: cluster, stats: stats, analyse: analyse, nearestGroup: nearestGroup,
    tokens: tokens, consolidate: consolidate, tidy: tidy, moderate: moderate
  };
})();

if (typeof module !== "undefined") module.exports = PV_ENGINE;
