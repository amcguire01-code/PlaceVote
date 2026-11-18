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
      if (!best || s > best.score) best = { k: k, labels: run.labels, cents: run.cents, score: s };
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
    loo: "toilet", loos: "toilet", wc: "toilet", toilets: "toilet", lavatory: "toilet",
    doctor: "gp", doctors: "gp", surgery: "gp", appointment: "gp", appointments: "gp",
    speed: "speeding", speeds: "speeding", fast: "speeding", "20mph": "speeding",
    unsafe: "safety", safe: "safety", scary: "safety", crime: "safety", cctv: "safety", cameras: "safety",
    canal: "towpath", path: "towpath"
  };
  function tokens(text) {
    return words(text).filter(function (w) {
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

  // ---------- shapes ----------
  // A shape is {type: "point"|"line"|"area"|"wide", pts: [[x, y], ...]}.
  // Statements without a shape are points at (x, y).
  function shapeOf(s) {
    if (s.geom && s.geom.type === "wide") return { type: "wide", pts: [] };
    if (s.geom && s.geom.pts && s.geom.pts.length) return s.geom;
    if (s.x === null || s.x === undefined) return { type: "wide", pts: [] };
    return { type: "point", pts: [[s.x, s.y]] };
  }
  // Points along the shape every ~20 map units, so distances work for routes and outlines.
  function samples(g) {
    var pts = g.pts.slice(), out = [];
    if (g.type === "area") pts.push(pts[0]);
    if (pts.length === 1) return pts;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 20));
      for (var k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function inside(p, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  // Shortest distance between two shapes (0 if one is inside an area). null if either is whole-area.
  function shapeDistance(g1, g2) {
    if (g1.type === "wide" || g2.type === "wide") return null;
    var s1 = samples(g1), s2 = samples(g2), i, j, best = Infinity;
    if (g1.type === "area") for (i = 0; i < s2.length; i++) if (inside(s2[i], g1.pts)) return 0;
    if (g2.type === "area") for (i = 0; i < s1.length; i++) if (inside(s1[i], g2.pts)) return 0;
    var e1 = edges(g1), e2 = edges(g2);
    for (i = 0; i < s1.length; i++) for (j = 0; j < e2.length; j++) best = Math.min(best, segDist(s1[i], e2[j][0], e2[j][1]));
    for (i = 0; i < s2.length; i++) for (j = 0; j < e1.length; j++) best = Math.min(best, segDist(s2[i], e1[j][0], e1[j][1]));
    return best;
  }
  function edges(g) {
    var pts = g.pts.slice(), out = [];
    if (g.type === "area") pts.push(pts[0]);
    if (pts.length === 1) return [[pts[0], pts[0]]];
    for (var i = 0; i < pts.length - 1; i++) out.push([pts[i], pts[i + 1]]);
    return out;
  }
  // Exact distance from point p to the segment a-b.
  function segDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  // Where to put a shape's pin: the point, the middle of a route, or the middle of an area.
  function anchor(g) {
    if (g.type === "wide" || !g.pts.length) return null;
    if (g.type === "point") return g.pts[0].slice();
    if (g.type === "area") {
      var sx = 0, sy = 0; g.pts.forEach(function (p) { sx += p[0]; sy += p[1]; });
      return [Math.round(sx / g.pts.length), Math.round(sy / g.pts.length)];
    }
    var s = samples(g); return s[Math.floor(s.length / 2)].map(Math.round);
  }

  // ---------- topics and for/against (offline stand-ins for an AI model) ----------
  // Two-word phrases are joined first, so "car park" is never read as a park.
  var PHRASES = [
    [/\bcar ?parks?\b/g, "carpark"], [/\bretail parks?\b/g, "retailpark"], [/\blow[- ]traffic( neighbourhoods?)?\b/g, "ltn"],
    [/\brat[- ]?runs?\b/g, "ratrun"], [/\bthrough[- ]traffic\b/g, "throughtraffic"], [/\bfly[- ]?tipping\b/g, "flytipping"],
    [/\bget(ting)? rid( of)?\b/g, "getrid"], [/\bbring(ing)? back\b/g, "bringback"], [/\bno more\b/g, "nomore"],
    [/\b(rough sleep(ers|ing)?|sleeping rough)\b/g, "roughsleeping"], [/\bhigh street\b/g, "highstreet"], [/\bbus stops?\b/g, "busstop"],
    [/\bdo ?n[o']?t\b/g, "dont"], [/\bshould ?n[o']?t\b/g, "shouldnt"], [/\bcan[no']*t\b/g, "cant"], [/\bpublic loos?\b/g, "toilet"], [/\bbus depot\b/g, "depot"], [/\bpump ?tracks?\b/g, "pumptrack"], [/\bskate ?parks?\b/g, "skatepark"]
  ];
  var TOPICS = {
    toilets: ["Public toilets", "toilet toilets loo loos wc wcs lavatory lavatories"],
    lighting: ["Lighting", "light lights lighting lit dark darkness streetlight streetlights lamp lamps"],
    cycling: ["Cycling", "cycle cycling cyclist cyclists bike bikes biking cycleway"],
    ltn: ["Low-traffic neighbourhoods", "ltn filter filters filtered"],
    traffic: ["Through-traffic", "traffic throughtraffic ratrun lorries vehicles congestion"],
    speed: ["Speeding and speed limits", "speeding speed 20mph speeds"],
    parking: ["Parking", "parking parked carpark bays"],
    parks: ["Parks and open space", "park parks green meadow grass"],
    trees: ["Trees", "tree trees planting"],
    growing: ["Food growing", "allotment allotments garden gardens growing"],
    play: ["Play", "swing swings playground playgrounds slide slides pumptrack skatepark"],
    young: ["Young people", "youth young kids children teenagers teens teenager"],
    housing: ["Housing and development", "homes houses housing flats affordable development developers"],
    shops: ["High street and market", "shop shops shopping units highstreet market traders businesses makers"],
    health: ["Health services", "gp doctor doctors surgery appointment appointments pharmacy health"],
    safety: ["Crime and safety", "cctv cameras crime antisocial police unsafe"],
    board: ["How the Board works", "publish decisions minutes budget spending spends accountable transparency"],
    energy: ["Energy", "solar energy panels renewable"],
    litter: ["Litter and bins", "bins bin litter rubbish flytipping"],
    buses: ["Buses", "bus buses busstop shelter"],
    rail: ["Station", "station train trains"],
    canal: ["Canal and towpath", "canal towpath"],
    roughsleeping: ["People sleeping rough", "roughsleeping homeless homelessness"]
  };
  // Topics where "for" and "against" don't have a clear meaning ("introduce a 20mph limit" vs "stop speeding").
  var NO_DIRECTION = { speed: 1, safety: 1 };
  var WORD_TOPIC = {};
  Object.keys(TOPICS).forEach(function (k) { TOPICS[k][1].split(" ").forEach(function (w) { WORD_TOPIC[w] = k; }); });
  var UP = "add more build install open extend reopen create introduce plant provide allow keep protect improve fund expand increase bringback new support make put turn widen".split(" ");
  var DOWN = "close closed closing remove ban banned stop scrap reduce fewer less getrid block blocked restrict cut demolish shut end oppose prevent lock locked nomore".split(" ");
  var NEG = "no not dont never shouldnt cant without".split(" ");

  function words(text) {
    var t = " " + (text || "").toLowerCase().replace(/[’']/g, "'") + " ";
    PHRASES.forEach(function (p) { t = t.replace(p[0], p[1]); });
    return t.replace(/[^a-z0-9' ]+/g, " ").replace(/'/g, "").split(/\s+/).filter(Boolean);
  }
  function actionAt(w, i) {
    var dir = UP.indexOf(w[i]) >= 0 ? 1 : DOWN.indexOf(w[i]) >= 0 ? -1 : 0;
    if (!dir) return 0;
    for (var k = Math.max(0, i - 2); k < i; k++) if (NEG.indexOf(w[k]) >= 0) dir = -dir; // "don't close", "not build"
    return dir;
  }
  function topicOfWord(word) {
    return WORD_TOPIC[word] || (word.length > 4 && /s$/.test(word) ? WORD_TOPIC[word.slice(0, -1)] : null) || null;
  }
  // Which topics a text mentions, and which way it pushes each one:
  //   1 = for (add, open, keep...), -1 = against (close, remove, ban...), 0 = no direction,
  //   "?" = unclear: "no toilets in the park" could be a complaint (wants toilets) or opposition.
  // e.g. "Close Hollins Park at night" -> {green: -1}; "through-traffic blocked" -> {traffic: -1}
  // Words straight after these describe WHERE an idea is ("toilets in the park"), not WHAT it is.
  var PLACE_WORDS = "in at on near by behind outside along around opposite beside to next".split(" ");
  function isPlaceMention(w, i) {
    for (var k = Math.max(0, i - 3); k < i; k++) if (PLACE_WORDS.indexOf(w[k]) >= 0) {
      // only if nothing between the place word and here is itself a topic or an action
      var clean = true;
      for (var m = k + 1; m < i; m++) if (topicOfWord(w[m]) || actionAt(w, m)) clean = false;
      if (clean) return true;
    }
    return false;
  }
  function topics(text) {
    var w = words(text), out = {}, places = {};
    w.forEach(function (word, i) {
      var t = topicOfWord(word); if (!t) return;
      if (isPlaceMention(w, i)) { places[t] = 1; return; }
      var dir = 0, best = 99, j, d;
      for (j = Math.max(0, i - 6); j < i; j++) { d = actionAt(w, j); if (d && i - j <= best) { best = i - j; dir = d; } }
      for (j = i + 1; j <= Math.min(w.length - 1, i + 2); j++) { d = actionAt(w, j); if (d && j - i < best) { best = j - i; dir = d; } }
      // "protect the park FROM development": what follows "from" is pushed the other way
      var fromAt = w.lastIndexOf("from", i);
      if (fromAt > -1 && i - fromAt <= 4 && w.slice(Math.max(0, fromAt - 6), fromAt).some(function (x) { return x === "protect" || x === "keep"; })) dir = -1;
      if (!dir && w.slice(Math.max(0, i - 2), i).indexOf("no") >= 0) dir = "?";
      if (NO_DIRECTION[t]) dir = 0;
      if (!(t in out) || (out[t] === 0 && dir)) out[t] = dir;
    });
    // If the only topic words were places ("something for the park"), keep them as the topic.
    if (!Object.keys(out).length) Object.keys(places).forEach(function (k) { out[k] = 0; });
    return out;
  }
  // The main topic of a statement: the one mentioned most across its wording and source ideas.
  function mainTopic(texts) {
    var count = {};
    texts.forEach(function (t, i) {
      Object.keys(topics(t)).forEach(function (k) { count[k] = (count[k] || 0) + (i === 0 ? 2 : 1); });
      // "turn the car park INTO a pump track": the idea is what comes after "into"
      var after = / into (.*)$/i.exec(t || "");
      if (after) Object.keys(topics(after[1])).forEach(function (k) { count[k] = (count[k] || 0) + 1; });
    });
    var best = null; Object.keys(count).forEach(function (k) { if (!best || count[k] > count[best]) best = k; });
    return best;
  }
  function topicName(k) { return k && TOPICS[k] ? TOPICS[k][0] : "Other"; }

  // ---------- consolidation of new contributions ----------
  // Map units are roughly 2 metres each. Separate sites further apart than this never merge.
  var SAME_PLACE = 110;
  var M_PER_UNIT = 2;

  // Compare one idea with one statement. Returns similarity and the reason it would or wouldn't merge.
  function compare(contrib, s) {
    var ct = topics(contrib.text), st = topics(s.text);
    // Topic overlap is judged against the statement's own wording, not every side-topic in its source ideas.
    var cAll = Object.keys(ct), sKeys = Object.keys(st);
    var shared = cAll.filter(function (k) { return k in st; });
    var union = cAll.length + sKeys.length - shared.length;
    var topicSim = union ? shared.length / union : 0;
    var wordSim = cosine(bag(tokens(contrib.text)), bag(tokens([s.text].concat(s.sources || []).join(" "))));
    var sim = 0.6 * topicSim + 0.4 * wordSim;
    var opposed = shared.filter(function (k) { return (ct[k] === 1 || ct[k] === -1) && (st[k] === 1 || st[k] === -1) && ct[k] !== st[k]; });
    var unclear = shared.filter(function (k) { return ct[k] === "?" && st[k] && st[k] !== "?"; });
    var cg = shapeOf(contrib), sg = shapeOf(s), d = shapeDistance(cg, sg);
    var bothWide = cg.type === "wide" && sg.type === "wide", mixed = (cg.type === "wide") !== (sg.type === "wide");
    // Both must share a topic and some wording. Wording alone only counts when the dictionary found no topic at all.
    var sameTopic = topicSim >= 0.3 && wordSim >= 0.2 || (wordSim >= 0.45 && (!cAll.length || !sKeys.length));
    var reason, ok = false;
    if (!sameTopic) reason = "Different topic";
    else if (unclear.length && (mixed || bothWide || d <= SAME_PLACE)) reason = "Same topic and place, but unclear whether it's for or against: an officer will check";
    else if (opposed.length) reason = "Same topic, but the opposite view: kept apart so the vote shows the split";
    else if (mixed && wordSim < 0.6) reason = "One is for the whole area, the other for one place";
    else if (!mixed && !bothWide && d > SAME_PLACE) reason = "Same topic, but about " + Math.round(d * M_PER_UNIT / 50) * 50 + " m away: kept as a separate site";
    else { ok = true; reason = bothWide ? "Same topic, both for the whole area" : "Same topic, same place"; }
    return { id: s.id, sim: sim, topicSim: topicSim, wordSim: wordSim, distance: d, opposed: opposed, unclear: unclear.length > 0 && /unclear/.test(reason), sameTopic: sameTopic, ok: ok, reason: reason };
  }

  // contrib: {geom or x/y, text}. statements: [{id, x, y, geom, text, sources:[text...]}]
  // Merges only when: same topic, not opposite views, and the same place (or both whole-area).
  function consolidate(contrib, statements) {
    var ranked = statements.map(function (s) { return compare(contrib, s); })
      .sort(function (a, b) { return (b.ok - a.ok) || (b.sim - a.sim); });
    var top = ranked[0];
    var merge = !!(top && top.ok);
    var unclearHit = !merge && ranked.some(function (r) { return r.unclear; });
    var related = ranked.filter(function (r) { return r.sameTopic && !r.ok; });
    return {
      action: merge ? "merge" : unclearHit ? "review" : "new", match: top, ranked: ranked.filter(function (r) { return r.sameTopic || r.sim > 0.1; }).slice(0, 3),
      related: related, topic: mainTopic([contrib.text])
    };
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

  // Moderation for the demo.
  //   block: never shown (insults, personal details).
  //   review: held for an officer, because it targets a group of people rather than a place or service.
  var BLOCK = ["idiot", "scum", "stupid", "f***", "shit", "fuck", "bastard", "vermin"];
  var GROUPS = /\b(homeless|roughsleeping|beggars?|junkies|druggies|addicts|immigrants?|migrants?|asylum|refugees?|travellers?|gypsies|foreigners|yobs|chavs|hoodies|students|youths)\b/;
  var REMOVE = /\b(getrid|remove|move on|moved on|kick out|keep out|ban|banned|clear out|drive out|go back|out of)\b/;
  function moderate(text) {
    var t = (text || "").trim();
    if (t.length < 12) return { block: "Add a little more detail (at least a short sentence)." };
    if (t.length > 220) return { block: "Keep it under 220 characters so others can read and vote on it quickly." };
    var lower = t.toLowerCase();
    for (var i = 0; i < BLOCK.length; i++) if (lower.indexOf(BLOCK[i]) >= 0) return { block: "Please rephrase without insults or swearing." };
    if (/\b\d{1,3}\s+[a-z]+\s+(street|road|lane|avenue|close|drive)\b/i.test(t)) return { block: "Please don't include house numbers or anyone's address." };
    if (/@|\b07\d{3}\s?\d{6}\b/.test(t)) return { block: "Please don't include contact details." };
    var letters = t.replace(/[^A-Za-z]/g, "");
    if (letters.length > 15 && letters === letters.toUpperCase()) return { block: "Please don't write in all capitals." };
    var w = words(t).join(" ");
    if (GROUPS.test(w) && REMOVE.test(w)) return { review: "Ideas need to be about places and services, not groups of people. An officer will review this one and may reword it into something everyone can vote on, such as support services or action on specific behaviour." };
    return null;
  }

  return {
    rng: rng, simulate: simulate, pca: pca, project: project, kmeans: kmeans, silhouette: silhouette,
    cluster: cluster, stats: stats, analyse: analyse, nearestGroup: nearestGroup,
    tokens: tokens, consolidate: consolidate, compare: compare, topics: topics, mainTopic: mainTopic, topicName: topicName, SAME_PLACE: SAME_PLACE, M_PER_UNIT: M_PER_UNIT, shapeOf: shapeOf, shapeDistance: shapeDistance, anchor: anchor, tidy: tidy, moderate: moderate
  };
})();

if (typeof module !== "undefined") module.exports = PV_ENGINE;
