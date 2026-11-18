// PlaceVote page code: draws the map and the three steps (ideas, vote, results).
{
  const D = PV_DATA, E = PV_ENGINE;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const GCOL = ["var(--gA)", "var(--gB)", "var(--gC)", "var(--gD)"];
  const GNAME = i => "Group " + "ABCD"[i];
  const pct = p => Math.round(p * 100) + "%";
  const KEY = "placevote-hollins-v3";

  // ---------- the simulated neighbourhood (fixed seed, so the same for every visitor) ----------
  const sim = E.simulate(D.groupSpec, 7);
  const A = E.analyse(sim.votes);
  const NRES = sim.votes.length;
  const SEEDN = D.statements.length;

  // ---------- visitor state ----------
  let S = { tab: "ideas", votes: {}, mine: [], extra: [], held: [], sel: null, adding: false, draft: null, voteId: null, view: -1, outcome: null };
  try { const saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) Object.assign(S, { votes: saved.votes || {}, mine: saved.mine || [], extra: saved.extra || [], held: saved.held || [] }); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ votes: S.votes, mine: S.mine, extra: S.extra, held: S.held })); } catch (e) {} };

  function statements() {
    const base = D.statements.map(s => ({
      ...s,
      sources: D.raw.filter(r => r[0] === s.id).map(r => ({ text: r[3] })).concat(S.mine.filter(m => m.into === s.id).map(m => ({ text: m.text, you: true })))
    }));
    const extra = S.extra.map(s => ({ ...s, isNew: true, sources: S.mine.filter(m => m.into === s.id).map(m => ({ text: m.text, you: true })) }));
    return base.concat(extra);
  }
  const byId = id => statements().find(s => s.id === id);

  // ---------- map ----------
  const trees = [];
  { const r = E.rng(3); for (let i = 0; i < 46; i++) { const x = 60 + r() * 250, y = 395 + r() * 210; if (Math.abs(y - (560 - (x / 330) * 90)) > 22) trees.push([x, y, 6 + r() * 6]); } }
  function terraces() {
    let s = "";
    for (let y = 120; y < 300; y += 26) { s += `<rect class="blk" x="115" y="${y}" width="120" height="14" rx="2"/><rect class="blk" x="265" y="${y}" width="80" height="14" rx="2"/>`; }
    return s;
  }
  function estate() {
    let s = "";
    [[345, 430], [345, 560], [490, 430]].forEach(([x, y]) => { s += `<rect class="blk" x="${x}" y="${y}" width="60" height="44" rx="3"/>`; });
    [[345, 595], [490, 500]].forEach(([x, y]) => { s += `<rect class="blk" x="${x}" y="${y}" width="44" height="30" rx="3"/>`; });
    return s;
  }
  const road = (d, w) => `<path class="cas" d="${d}" stroke-width="${w + 5}"/>`;
  const road2 = (d, w) => `<path class="road" d="${d}" stroke-width="${w}"/>`;
  const ROADS = [["M60 335H965", 20], ["M720 335V62", 15], ["M250 335V95", 13], ["M450 335V640", 14], ["M880 335V215", 10], ["M450 470H680", 10]];
  const BASE = `
    <defs><pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" class="land"/><line x1="0" y1="0" x2="0" y2="10" stroke="var(--block)" stroke-width="5"/></pattern></defs>
    <rect class="land" width="1000" height="640"/>
    <path class="park" d="M40 372 Q40 362 50 362 L318 376 L330 628 L40 628 Z"/>
    ${trees.map(t => `<circle class="tree" cx="${t[0].toFixed(0)}" cy="${t[1].toFixed(0)}" r="${t[2].toFixed(1)}"/>`).join("")}
    <rect class="hatch" x="520" y="560" width="130" height="70" rx="4"/>
    ${terraces()}${estate()}
    <rect class="blk" x="405" y="508" width="70" height="26" rx="3"/>
    <rect class="blk" x="352" y="238" width="58" height="48" rx="3"/>
    <rect class="blk" x="565" y="440" width="70" height="56" rx="3"/>
    <rect class="hatch" x="560" y="358" width="100" height="62" rx="3"/>
    <rect class="blk" x="800" y="398" width="62" height="52" rx="3"/>
    <rect class="hatch" x="870" y="215" width="95" height="80" rx="3"/>
    <rect class="blk" x="860" y="480" width="110" height="120" rx="3"/>
    <path class="water" d="M-10 566 C 200 530, 330 450, 450 382 S 650 252, 760 212 S 920 160, 1010 150"/>
    ${ROADS.map(r => road(r[0], r[1])).join("")}${ROADS.map(r => road2(r[0], r[1])).join("")}
    <line class="rail" x1="0" y1="62" x2="1000" y2="62"/><line class="ties" x1="0" y1="62" x2="1000" y2="62"/>
    <rect x="684" y="44" width="72" height="34" rx="3" fill="var(--ink)"/>
    <text class="lbl big" x="70" y="600">Hollins Park</text>
    <text class="lbl" x="118" y="112">Mill Lane terraces</text>
    <text class="lbl" x="770" y="38">Hollins Green station</text>
    <text class="lbl" x="88" y="326">Market Street</text>
    <text class="lbl" x="340" y="420">Brookside estate</text>
    <text class="lbl it" x="250" y="500" transform="rotate(-24 250 500)">Ashworth Canal</text>
    <text class="lbl" x="845" y="208">Old bus depot</text>
    <text class="lbl" x="866" y="620">Retail park</text>
    <text class="lbl" x="352" y="232">Library</text>
    <text class="lbl" x="560" y="433">School</text>
    <text class="lbl" x="770" y="468">Health centre</text>
    <text class="lbl" x="522" y="552">Allotments</text>`;

  const map = $("#map");
  map.innerHTML = `<g id="base">${BASE}</g><g id="pins"></g>`;

  // colour of a pin in results mode
  function shade(p, col) { return `color-mix(in srgb, ${col} ${Math.round(12 + p * 88)}%, var(--bg))`; }
  function statForId(id) { const i = D.statements.findIndex(s => s.id === id); return i < 0 ? null : A.stats[i]; }

  const shapeOf = s => E.shapeOf(s.geom ? s : { x: s.x, y: s.y });
  const SHAPE_NAME = { line: "Route", area: "Area", wide: "Whole area" };
  const shapeTag = s => { const t = shapeOf(s).type; return SHAPE_NAME[t] ? `<span class="tag">${SHAPE_NAME[t]}</span>` : ""; };
  const pathD = (pts, close) => "M" + pts.map(p => p[0] + " " + p[1]).join("L") + (close ? "Z" : "");

  // colour for a statement: default ink, or share who agree in results view
  function colourFor(s) {
    if (S.tab !== "results") return { fill: "var(--ink)", txt: "var(--bg)", title: s.text, p: null };
    const st = statForId(s.id);
    if (!st) return { fill: "var(--bg)", txt: "var(--mute)", title: s.text + " (new: no votes from others yet)", p: null };
    const g = S.view < 0 ? st.all : st.groups[S.view];
    const col = S.view < 0 ? "var(--agree)" : GCOL[S.view];
    return { fill: shade(g.pa, col), txt: g.pa > 0.55 ? "#fff" : "var(--ink)", title: `${s.text} (${pct(g.pa)} agree${S.view < 0 ? "" : " in " + GNAME(S.view)})`, p: g.pa };
  }

  function drawPins() {
    const list = statements();
    const focus = S.tab === "vote" ? currentVoteId() : null;
    const focusWide = focus !== null && shapeOf(byId(focus)).type === "wide";
    let shapes = "", pins = "";
    list.forEach(s => {
      const g = shapeOf(s), c = colourFor(s);
      const on = S.sel === s.id || focus === s.id;
      const dim = focus !== null && s.id !== focus ? " dim" : "";
      if (g.type === "wide") return; // shown in the whole-area strip, not on the map
      const res = S.tab === "results";
      if (g.type === "line") {
        shapes += `<g class="shape${dim}" data-id="${s.id}"><title>${esc(c.title)}</title><path d="${pathD(g.pts)}" fill="none" stroke="var(--bg)" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/><path d="${pathD(g.pts)}" fill="none" stroke="${on ? "var(--accent)" : res ? c.fill : "var(--ink)"}" stroke-width="${on ? 9 : 7}" stroke-linejoin="round" stroke-linecap="round" ${res ? "" : 'stroke-dasharray="14 8"'} opacity="${res || on ? 1 : 0.7}"/></g>`;
      } else if (g.type === "area") {
        shapes += `<g class="shape${dim}" data-id="${s.id}"><title>${esc(c.title)}</title><path d="${pathD(g.pts, true)}" fill="${res ? c.fill : "var(--ink)"}" fill-opacity="${res ? 0.55 : on ? 0.16 : 0.08}" stroke="${on ? "var(--accent)" : res ? c.fill : "var(--ink)"}" stroke-width="${on ? 5 : 3}" stroke-dasharray="${res ? "" : "10 6"}" stroke-linejoin="round"/></g>`;
      }
      pins += `<g class="pin${dim}${on ? " sel" : ""}" data-id="${s.id}" tabindex="0" role="button" aria-label="Statement ${s.id}: ${esc(s.text)}"><title>${esc(c.title)}</title><circle cx="${s.x}" cy="${s.y}" r="${on ? 20 : 16}" fill="${c.fill}" ${s.isNew ? 'stroke-dasharray="4 3"' : ""}/><text x="${s.x}" y="${s.y + 1}" fill="${c.txt}">${s.id}</text></g>`;
    });
    let draft = "";
    if (S.adding && S.draft && S.draft.pts.length) {
      const d = S.draft, pts = d.pts;
      if (d.type === "line" && pts.length > 1) draft += `<path d="${pathD(pts)}" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (d.type === "area" && pts.length > 1) draft += `<path d="${pathD(pts, pts.length > 2)}" fill="var(--accent)" fill-opacity=".22" stroke="var(--accent)" stroke-width="4" stroke-linejoin="round"/>`;
      if (d.type === "point") draft += `<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="26" fill="none" stroke="var(--accent)" stroke-width="3" opacity=".6"/><circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="12"/>`;
      else draft += pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 9 : 7}"/>`).join("");
    }
    $("#pins").innerHTML = shapes + pins + `<g class="draft">${draft}</g>`;
    map.classList.toggle("adding", S.adding && S.draft && S.draft.type !== "wide");
    map.classList.toggle("whole", focusWide || (S.adding && S.draft && S.draft.type === "wide"));

    // whole-area strip under the map
    const wide = list.filter(s => shapeOf(s).type === "wide");
    $("#wide").innerHTML = wide.length ? `<h3>Whole-area ideas <span class="small mute" style="font-weight:400">· apply to all of Hollins Green</span></h3><div class="wlist">${wide.map(s => {
      const c = colourFor(s), on = S.sel === s.id || focus === s.id;
      return `<button class="wpill${on ? " sel" : ""}${focus !== null && !on ? " dim" : ""}" data-id="${s.id}" title="${esc(c.title)}"><span class="num" style="background:${c.fill};color:${c.txt}">${s.id}</span><span>${esc(s.text)}</span>${c.p !== null ? `<b>${pct(c.p)}</b>` : ""}</button>`;
    }).join("")}</div>` : "";

    const lg = $("#legend");
    if (S.tab === "results") {
      const col = S.view < 0 ? "var(--agree)" : GCOL[S.view];
      lg.innerHTML = `<span>Colour: share of ${S.view < 0 ? "all residents" : GNAME(S.view)} who agree</span><span>0%</span><span class="ramp" style="background:linear-gradient(90deg,${shade(0, col)},${shade(1, col)})"></span><span>100%</span>`;
    } else if (S.adding && S.draft) {
      const d = S.draft, n = d.pts.length;
      const msg = {
        point: n ? "Pin placed. Tap somewhere else to move it." : "Tap the map where your idea applies.",
        line: n ? `Route: ${n} point${n === 1 ? "" : "s"}. Keep tapping along it${n >= 2 ? ", or tap Done" : ""}.` : "Tap the start of the route, then each turn along it.",
        area: n ? `Area: ${n} corner${n === 1 ? "" : "s"}. Keep tapping round the edge${n >= 3 ? ", or tap Done" : ""}.` : "Tap round the edge of the area, corner by corner.",
        wide: "No need to use the map: this idea covers the whole of Hollins Green."
      }[d.type];
      const tools = (d.type === "line" || d.type === "area") && n ? `<button class="btn mini" data-act="undo">Undo point</button><button class="btn mini primary" data-act="done" ${draftOK() ? "" : "disabled"}>Done</button>` : "";
      lg.innerHTML = `<span style="color:var(--accent);font-weight:600">${msg}</span>${tools}`;
    } else if (focusWide) {
      lg.innerHTML = `<span style="color:var(--accent);font-weight:600">This idea applies to the whole of Hollins Green.</span>`;
    } else {
      lg.innerHTML = `<span>Pins, dashed routes and dashed areas are statements residents vote on. Select one to see the ideas it was built from.</span>`;
    }
  }
  function draftOK() {
    const d = S.draft; if (!d) return false;
    return d.type === "wide" || (d.type === "point" && d.pts.length === 1) || (d.type === "line" && d.pts.length >= 2) || (d.type === "area" && d.pts.length >= 3);
  }

  function svgPoint(evt) {
    const pt = map.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(map.getScreenCTM().inverse());
    return [Math.round(Math.max(10, Math.min(990, p.x))), Math.round(Math.max(10, Math.min(630, p.y)))];
  }
  const toForm = () => {
    const t = $("#idea");
    if (t) { if (window.innerWidth <= 860) t.scrollIntoView({ behavior: "smooth", block: "center" }); t.focus({ preventScroll: true }); }
  };
  map.addEventListener("click", e => {
    if (S.adding && S.draft && S.draft.type !== "wide") {
      const p = svgPoint(e);
      if (S.draft.type === "point") { S.draft.pts = [p]; render(); toForm(); }
      else { S.draft.pts.push(p); render(); }
      return;
    }
    if (S.adding) return;
    const g = e.target.closest(".pin,.shape"); if (!g) return;
    selectPin(+g.dataset.id);
  });
  map.addEventListener("keydown", e => {
    const g = e.target.closest && e.target.closest(".pin");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); selectPin(+g.dataset.id); }
  });
  $("#wide").addEventListener("click", e => { const b = e.target.closest(".wpill"); if (b && !S.adding) selectPin(+b.dataset.id); });
  $("#legend").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b || !S.draft) return;
    if (b.dataset.act === "undo") { S.draft.pts.pop(); render(); }
    if (b.dataset.act === "done") toForm();
  });
  function selectPin(id) {
    if (S.tab === "vote") { S.voteId = id; }
    else if (S.tab === "results" || S.tab === "officer") { S.sel = S.sel === id ? null : id; }
    else { S.tab = "ideas"; S.sel = S.sel === id ? null : id; S.outcome = null; }
    render();
  }

  // ---------- step 1: ideas ----------
  const MODES = [["point", "Point", "A specific spot"], ["line", "Route", "A street, path or route"], ["area", "Area", "A zone or patch of land"], ["wide", "Whole area", "A policy for all of Hollins Green"]];
  function ideasPanel() {
    const list = statements();
    const rawN = D.raw.length + S.mine.length;
    let h = `<section><h2>Ideas on the map</h2>
      <p>${NRES} residents shared ${rawN} ideas: pinned to spots, drawn along routes, marked as areas, or for the whole neighbourhood. Overlapping ideas were merged into ${list.length} statements, so everyone votes on the same short list.</p>
      ${S.adding ? "" : `<button class="btn primary" data-act="add">Add your idea</button>`}</section>`;

    if (S.adding) {
      const d = S.draft, wide = d.type === "wide";
      const hint = {
        point: d.pts.length ? "Pin placed on the map." : "Tap the map where your idea applies.",
        line: d.pts.length >= 2 ? `Route drawn with ${d.pts.length} points.` : "Tap along the route on the map, point by point.",
        area: d.pts.length >= 3 ? `Area drawn with ${d.pts.length} corners.` : "Tap round the edge of the area on the map.",
        wide: "This idea will apply to the whole of Hollins Green."
      }[d.type];
      h += `<section class="card"><h3>Your idea</h3>
        <div class="seg" role="radiogroup" aria-label="What does your idea cover?">${MODES.map(m => `<button role="radio" aria-checked="${d.type === m[0]}" data-mode="${m[0]}"><b>${m[1]}</b><span>${m[2]}</span></button>`).join("")}</div>
        <p class="small" style="color:${draftOK() ? "var(--agree)" : "var(--accent)"};font-weight:600">${hint}</p>
        <label for="idea">${wide ? "What should change across Hollins Green?" : "What should change here?"}</label>
        <textarea id="idea" maxlength="240" placeholder="${wide ? "e.g. Hold Board meetings in the evening so people who work can come" : "e.g. The bus stop on Market Street needs a shelter and a bench"}">${esc(S.text || "")}</textarea>
        <label for="cat">Topic</label>
        <select id="cat">${D.categories.map(c => `<option${c === S.cat ? " selected" : ""}>${c}</option>`).join("")}</select>
        <div class="err" id="err"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn primary" data-act="submit" ${draftOK() ? "" : "disabled"}>Add idea</button>
          <button class="btn" data-act="cancel">Cancel</button></div>
        <p class="small mute">Please keep to places and policies, not people: no names, addresses or contact details.</p></section>`;
    }

    if (S.outcome) h += outcomeCard(S.outcome);

    if (S.sel !== null && byId(S.sel)) {
      const s = byId(S.sel);
      h += `<section class="card"><div class="meta"><span class="num">${s.id}</span><span>${esc(s.place || "New this round")}</span>${shapeTag(s)}<span class="tag">${esc(s.cat)}</span></div>
        <p class="stmt">${esc(s.text)}</p>
        <h3 style="margin-top:14px">Built from ${s.sources.length} idea${s.sources.length === 1 ? "" : "s"}</h3>
        ${s.sources.map(r => `<div class="quote${r.you ? " you" : ""}">${r.you ? "<b>You:</b> " : ""}“${esc(r.text)}”</div>`).join("")}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" data-act="voteon" data-id="${s.id}">Vote on this</button><button class="btn" data-act="close">Back to list</button></div></section>`;
    } else {
      h += `<section><h3>All statements</h3><ul class="list">${list.map(s => `
        <li class="row" tabindex="0" data-pick="${s.id}"><span class="num">${s.id}</span><span class="t">${esc(s.text)}<br><span class="small mute">${esc(s.place || "New this round")} · ${s.sources.length} idea${s.sources.length === 1 ? "" : "s"}</span></span>${shapeTag(s)}${s.isNew ? '<span class="tag you">yours</span>' : ""}</li>`).join("")}</ul></section>`;
    }
    return h;
  }

  const metres = d => d === null || d === undefined ? "" : `${Math.round(d * E.M_PER_UNIT / 50) * 50} m`;
  function outcomeCard(o) {
    if (o.action === "held") {
      return `<section class="card" style="border-color:var(--accent)"><h3>Held for an officer to review</h3>
        <p>${esc(o.why)}</p><p class="small mute">It won't go to the vote as written. You'll see it in the Officer view tab, which is what a Board officer would work from.</p>
        <button class="btn" data-act="tab" data-tab="officer">See the Officer view</button></section>`;
    }
    const s = byId(o.into);
    const rows = o.ranked.map(r => { const t = byId(r.id); return `<div class="why"><span class="num">${r.id}</span><span><b>${esc(t ? t.text : "")}</b><br><span class="small" style="color:${r.ok ? "var(--agree)" : "var(--mute)"}">${esc(r.reason)}</span></span></div>`; }).join("");
    const sep = (o.related || []).filter(r => /separate site/.test(r.reason));
    const opp = (o.related || []).filter(r => /opposite/.test(r.reason));
    let body;
    if (o.disputed) body = `Done. Your idea is now its own statement, “${esc(s.text)}”, and the officer has been told the automatic merge got it wrong.`;
    else if (o.action === "merge") body = `It's the same topic and the same place as “${esc(s.text)}”, so it now counts as another source for that statement instead of splitting the vote.`;
    else body = `Nothing existing was the same idea in the same place, so it became a new statement: “${esc(s.text)}”. Other residents would now see it in their voting queue.`;
    let extra = "";
    if (sep.length) extra += `<p class="small">There's a similar idea elsewhere: ${sep.map(r => `<b>${r.id}</b> (${metres(r.distance)} away)`).join(", ")}. They stay as separate statements so people can back one site and not the other. The officer sees them grouped under the same topic.</p>`;
    if (opp.length) extra += `<p class="small">An opposite view already exists here: ${opp.map(r => `<b>${r.id}</b>`).join(", ")}. Both stay on the list so the vote shows the split.</p>`;
    return `<section class="card" style="border-color:var(--accent)">
      <h3>${o.action === "merge" ? `Merged into statement ${o.into}` : `New statement ${o.into} added to the vote`}</h3>
      <p>${body}</p>${extra}
      <details><summary>Show how it was matched</summary>
        <p class="small mute">Each idea is read for its topic (what it's about), its place (point, route, area or whole area) and its direction (for or against). It merges only if all three line up. Places more than about ${Math.round(E.SAME_PLACE * E.M_PER_UNIT / 10) * 10} m apart stay separate, and opposite views never merge.</p>${rows || '<p class="small">No similar statements.</p>'}</details>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-act="voteon" data-id="${o.into}">Vote on it</button>
      ${o.action === "merge" ? `<button class="btn" data-act="dispute">That's not what I meant</button>` : ""}</div></section>`;
  }

  function submitIdea() {
    const text = $("#idea").value, cat = $("#cat").value;
    const mod = E.moderate(text);
    if (mod && mod.block) { $("#err").textContent = mod.block; return; }
    if (!draftOK()) { $("#err").textContent = { point: "Tap the map to place your idea first.", line: "Tap at least two points to draw the route.", area: "Tap at least three corners to draw the area." }[S.draft.type]; return; }
    const geom = { type: S.draft.type, pts: S.draft.pts.slice() };
    const done = () => { S.adding = false; S.draft = null; S.text = ""; S.sel = null; save(); render(); };
    if (mod && mod.review) {
      S.held.push({ geom, text: text.trim(), cat, why: "About a group of people, not a place or service" });
      S.outcome = { action: "held", why: mod.review }; return done();
    }
    const all = statements();
    const res = E.consolidate({ geom, text }, all.map(s => ({ ...s, sources: s.sources.map(r => r.text) })));
    if (res.action === "review") {
      S.held.push({ geom, text: text.trim(), cat, why: "Unclear whether it's for or against statement " + res.ranked.find(r => r.unclear).id });
      S.outcome = { action: "held", why: "This is close to an existing statement, but it isn't clear whether you're for or against it. An officer will check, so your idea isn't counted the wrong way." };
      return done();
    }
    let into;
    if (res.action === "merge") into = res.match.id;
    else into = newStatement(geom, cat, text);
    S.mine.push({ geom, text: text.trim(), cat, into });
    S.outcome = { action: res.action, into, ranked: res.ranked, related: res.related, mine: S.mine.length - 1 };
    done();
  }
  function newStatement(geom, cat, text) {
    const into = Math.max(...statements().map(s => s.id)) + 1;
    const at = E.anchor(geom);
    S.extra.push({ id: into, x: at ? at[0] : null, y: at ? at[1] : null, geom, cat, place: geom.type === "wide" ? "Whole area" : "", text: E.tidy(text) });
    return into;
  }
  // "That's not what I meant": undo the merge, make the idea its own statement, flag it for the officer.
  function dispute() {
    const o = S.outcome, m = S.mine[o.mine]; if (!m) return;
    m.disputedFrom = m.into;
    m.into = newStatement(m.geom, m.cat, m.text);
    S.outcome = { action: "new", into: m.into, ranked: [], related: [], disputed: true };
    save(); render();
  }

  // ---------- step 2: vote ----------
  function currentVoteId() {
    const list = statements();
    if (S.voteId !== null && list.some(s => s.id === S.voteId)) return S.voteId;
    const next = list.find(s => !(s.id in S.votes));
    return next ? next.id : null;
  }
  function votePanel() {
    const list = statements(), done = list.filter(s => s.id in S.votes).length;
    const id = currentVoteId();
    let h = `<section><h2>Vote</h2><p class="small mute">${done} of ${list.length} voted</p><div class="progress"><i style="width:${(done / list.length) * 100}%"></i></div></section>`;
    if (id === null) {
      h += `<section class="card"><h3>You've voted on everything</h3><p>See where you sit among your neighbours, and where the whole area agrees.</p><button class="btn primary" data-act="tab" data-tab="results">See where we agree</button></section>`;
    } else {
      const s = byId(id), v = S.votes[id];
      h += `<section class="card"><div class="meta"><span class="num">${s.id}</span><span>${esc(s.place || "New this round")}</span><span class="tag">${esc(s.cat)}</span></div>
        <p class="stmt">${esc(s.text)}</p>
        <div class="votebar">
          <button class="btn vA ${v === 1 ? "on" : ""}" data-vote="1">Agree</button>
          <button class="btn vD ${v === -1 ? "on" : ""}" data-vote="-1">Disagree</button>
          <button class="btn ${v === 0 ? "on" : ""}" data-vote="0">Unsure</button></div>
        <p class="small mute" style="margin-top:12px">Votes are anonymous. There's no wrong answer, and you can change a vote at any time.</p></section>`;
    }
    h += `<section><h3>All statements</h3><ul class="list">${list.map(s => {
      const v = S.votes[s.id];
      const tag = v === 1 ? '<span class="tag" style="color:var(--agree)">Agree</span>' : v === -1 ? '<span class="tag" style="color:var(--disagree)">Disagree</span>' : v === 0 ? '<span class="tag">Unsure</span>' : "";
      return `<li class="row" tabindex="0" data-votepick="${s.id}"><span class="num">${s.id}</span><span class="t">${esc(s.text)}</span>${tag}</li>`;
    }).join("")}</ul></section>`;
    return h;
  }
  function castVote(v) {
    const id = currentVoteId(); if (id === null) return;
    S.votes[id] = v; S.voteId = null; save(); render();
  }

  // ---------- step 3: results ----------
  function me() {
    const row = D.statements.map(s => (s.id in S.votes ? S.votes[s.id] : null));
    const n = row.filter(v => v !== null).length;
    if (n < 4) return { n };
    const pt = E.project(A.model, row);
    return { n, pt, group: E.nearestGroup(pt, A.cents) };
  }

  function scatter() {
    const s = $("#scatter"); if (!s) return;
    const W = s.clientWidth, H = s.clientHeight, pad = 28;
    const pts = A.model.points, you = me();
    const all = you.pt ? pts.concat([you.pt]) : pts;
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const X = x => pad + (x - x0) / (x1 - x0 || 1) * (W - pad * 2), Y = y => pad + (y - y0) / (y1 - y0 || 1) * (H - pad * 2);
    let h = pts.map((p, i) => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4.5" fill="${GCOL[A.labels[i]]}" opacity="${S.view < 0 || S.view === A.labels[i] ? 0.8 : 0.15}"/>`).join("");
    h += A.cents.map((c, i) => `<text x="${X(c[0])}" y="${Y(c[1]) - 14}" text-anchor="middle" font-weight="800" font-size="15" fill="var(--ink)" paint-order="stroke" stroke="var(--card)" stroke-width="4">${GNAME(i)}</text>`).join("");
    if (you.pt) {
      const x = X(you.pt[0]), y = Y(you.pt[1]);
      h += `<circle cx="${x}" cy="${y}" r="11" fill="var(--accent)" stroke="var(--bg)" stroke-width="3"/><text x="${x}" y="${y + 28}" text-anchor="middle" font-weight="800" font-size="14" fill="var(--accent)" paint-order="stroke" stroke="var(--card)" stroke-width="4">You</text>`;
    }
    s.innerHTML = h;
  }

  function bars(st) {
    return `<div class="bars">${st.groups.map((g, i) => `<div class="bar"><span>${GNAME(i)}</span><div class="tr"><i style="width:${pct(g.pa)};background:${GCOL[i]}"></i></div><b>${pct(g.pa)}</b></div>`).join("")}</div>`;
  }
  function stRow(st, extra) {
    const s = D.statements[st.index];
    return `<li class="row" tabindex="0" data-rpick="${s.id}"><span class="num">${s.id}</span><span class="t">${esc(s.text)} <span class="small mute">· ${esc(s.place)}</span>${extra || ""}${bars(st)}</span></li>`;
  }
  function places(g) {
    return A.distinctive[g].filter(d => d.dir === 1 && shapeOf(D.statements[d.index]).type !== "wide").map(d => D.statements[d.index].place);
  }

  function report() {
    const you = me();
    const L = [];
    L.push(`${D.board}: consultation summary (demonstrator, simulated residents)`);
    L.push(`Question: ${D.question}`);
    L.push(`${NRES} residents, ${D.raw.length + S.mine.length} map ideas, ${statements().length} statements. ${A.k} opinion groups found (sizes ${A.sizes.join(", ")}).`);
    L.push("");
    L.push("COMMON GROUND (every group agrees, strongest first)");
    A.consensus.forEach(st => { const s = D.statements[st.index]; L.push(`- [${s.id}] ${s.text} (${s.place}); agree: ${st.groups.map((g, i) => GNAME(i).slice(-1) + " " + pct(g.pa)).join(", ")}`); });
    L.push("");
    L.push("WHERE GROUPS SPLIT (needs more deliberation before a decision)");
    A.divisive.slice(0, 5).forEach(st => { const s = D.statements[st.index]; L.push(`- [${s.id}] ${s.text} (${s.place}); agree: ${st.groups.map((g, i) => GNAME(i).slice(-1) + " " + pct(g.pa)).join(", ")}`); });
    L.push("");
    L.push("WHAT EACH GROUP CARES ABOUT, AND WHERE");
    A.distinctive.forEach((items, g) => {
      L.push(`- ${GNAME(g)} (${A.sizes[g]} people): ` + items.map(d => `${d.dir === 1 ? "for" : "against"} [${D.statements[d.index].id}] ${D.statements[d.index].place}`).join("; "));
    });
    if (S.extra.length) { L.push(""); L.push("NEW STATEMENTS THIS ROUND (not yet voted on by others)"); S.extra.forEach(s => L.push(`- [${s.id}] ${s.text}`)); }
    if (you.pt) { L.push(""); L.push(`Your votes place you closest to ${GNAME(you.group)}.`); }
    L.push(""); L.push("Note: participants are self-selected; treat groups as patterns of opinion, not a representative survey.");
    return L.join("\n");
  }

  function resultsPanel() {
    const you = me();
    let h = `<section><h2>Where Hollins Green agrees</h2>
      <div class="stats"><div class="stat"><b>${NRES}</b><span>residents voting</span></div><div class="stat"><b>${A.k}</b><span>opinion groups found</span></div><div class="stat"><b>${A.consensus.length}</b><span>statements with common ground</span></div></div>
      <p class="small mute">The residents are simulated. Their groups were not labelled in advance: the system found them from voting patterns alone.</p></section>
      <section><h3>Opinion map</h3><p class="small mute">Each dot is a resident. People who vote alike sit close together.</p>
      <div class="fig"><svg id="scatter" aria-label="Scatter of residents by voting pattern"></svg></div>
      <p class="small">${you.pt ? `Your votes put you closest to <b style="color:${GCOL[you.group]}">${GNAME(you.group)}</b>.` : `Vote on at least 4 statements to see where you sit (${you.n} so far). <button class="btn" data-act="tab" data-tab="vote" style="min-height:36px;padding:4px 12px">Vote</button>`}</p></section>
      <section><h3>Show agreement on the map for</h3><div class="chips">
        <button class="chip" data-view="-1" aria-pressed="${S.view < 0}">Everyone</button>
        ${A.sizes.map((n, i) => `<button class="chip" data-view="${i}" aria-pressed="${S.view === i}"><span class="dot" style="background:${GCOL[i]}"></span>${GNAME(i)} · ${n}</button>`).join("")}</div>
        ${S.view >= 0 ? `<p class="small"><b>${GNAME(S.view)}'s spatial signature:</b> what sets this group apart is concentrated at ${places(S.view).join(", ") || "no single place"}.</p>` : ""}</section>`;

    if (S.view >= 0) {
      h += `<section><h3>What sets ${GNAME(S.view)} apart</h3><ul class="list">${A.distinctive[S.view].map(d => {
        const st = A.stats[d.index];
        return stRow(st, `<br><span class="small" style="color:${d.dir === 1 ? "var(--agree)" : "var(--disagree)"}">${pct(d.p)} ${d.dir === 1 ? "agree" : "disagree"}, ${d.ratio >= 4 ? "far more than everyone else" : d.ratio.toFixed(1) + "× the rate of everyone else"}</span>`);
      }).join("")}</ul></section>`;
    }
    h += `<section><h3>Common ground</h3><p class="small mute">Statements that every group agrees with. These are the safest place for the Board to start.</p><ul class="list">${A.consensus.map(st => stRow(st)).join("")}</ul></section>
      <section><h3>Where groups split</h3><p class="small mute">The widest gaps between groups. These need more conversation, or a compromise, before a decision.</p><ul class="list">${A.divisive.slice(0, 5).map(st => stRow(st)).join("")}</ul></section>`;
    if (S.extra.length) h += `<section><h3>New this round</h3><p class="small mute">Your new statements. Only you have voted so far; in a live round, the next residents would be shown them.</p><ul class="list">${S.extra.map(s => `<li class="row"><span class="num">${s.id}</span><span class="t">${esc(s.text)}</span></li>`).join("")}</ul></section>`;
    h += `<section><h3>Summary for the Board</h3><pre id="report">${esc(report())}</pre>
      <button class="btn" data-act="copy">Copy summary</button> <span class="small mute" id="copied"></span>
      <p><button class="btn" data-act="reset" style="margin-top:12px">Clear my votes and ideas</button></p></section>`;
    return h;
  }

  // ---------- officer view ----------
  function topicBoard() {
    const list = statements(), by = {};
    list.forEach(st => {
      const k = E.mainTopic([st.text].concat(st.sources.map(r => r.text))) || "other";
      (by[k] = by[k] || []).push(st);
    });
    return Object.keys(by).map(k => {
      const sts = by[k], flags = [];
      for (let i = 0; i < sts.length; i++) for (let j = i + 1; j < sts.length; j++) {
        const a = sts[i], b = sts[j], c = E.compare({ x: a.x, y: a.y, geom: a.geom, text: a.text }, { ...b, sources: [] });
        if (c.opposed.length) flags.push({ kind: "opp", text: `<b>${a.id}</b> and <b>${b.id}</b> are opposite views. Both stay on the list so the vote shows the split.` });
        else if (c.sameTopic && /separate site/.test(c.reason)) flags.push({ kind: "site", text: `<b>${a.id}</b> and <b>${b.id}</b> are the same idea in different places (${metres(c.distance)} apart). Keep them separate if the choice of site is contested; otherwise combine them into one whole-area statement.` });
      }
      return { key: k, name: k === "other" ? "Other" : E.topicName(k), sts, ideas: sts.reduce((n, x) => n + x.sources.length, 0), flags };
    }).sort((a, b) => (b.flags.length - a.flags.length) || (b.ideas - a.ideas));
  }

  function officerPanel() {
    const board = topicBoard();
    const held = D.held.map(h => ({ ...h, seed: true, why: "About a group of people, not a place or service" })).concat(S.held);
    const disputed = S.mine.filter(m => m.disputedFrom);
    const flagged = board.reduce((n, t) => n + t.flags.length, 0);
    let h = `<section><h2>Officer view</h2>
      <p>What a Neighbourhood Board officer works from: every idea sorted into topics, with anything that needs a human decision flagged. In the full version, an AI model drafts the merged statements and the officer approves, edits, splits or combines them here.</p>
      <div class="stats"><div class="stat"><b>${board.length}</b><span>topics</span></div><div class="stat"><b>${statements().length}</b><span>statements</span></div><div class="stat"><b>${held.length + disputed.length + flagged}</b><span>need a decision</span></div></div></section>`;

    h += `<section><h3>Held for review</h3>${held.length ? `<ul class="list">${held.map(x => `<li class="row" style="cursor:default"><span class="t">“${esc(x.text)}”<br><span class="small" style="color:var(--accent)">${esc(x.why)}</span>${x.suggestion ? `<br><span class="small">Suggested rewording: <b>${esc(x.suggestion)}</b></span>` : ""}</span>${x.seed ? "" : '<span class="tag you">yours</span>'}</li>`).join("")}</ul>` : '<p class="small mute">Nothing waiting.</p>'}</section>`;

    if (disputed.length) h += `<section><h3>Residents who disputed a merge</h3><ul class="list">${disputed.map(m => `<li class="row" style="cursor:default"><span class="t">“${esc(m.text)}”<br><span class="small">Was merged into <b>${m.disputedFrom}</b>, now its own statement <b>${m.into}</b>. Check whether the merge rule needs adjusting.</span></span><span class="tag you">yours</span></li>`).join("")}</ul></section>`;

    h += `<section><h3>Topics</h3><p class="small mute">Grouped by what each statement is about, regardless of place. Topics with flags come first.</p>${board.map(t => `
      <div class="topic"><div class="topic-h"><b>${esc(t.name)}</b><span class="small mute">${t.ideas} idea${t.ideas === 1 ? "" : "s"} · ${t.sts.length} statement${t.sts.length === 1 ? "" : "s"}</span></div>
        ${t.flags.map(f => `<p class="flag ${f.kind}">${f.text}</p>`).join("")}
        <ul class="list">${t.sts.map(st => `<li class="row${S.sel === st.id ? " on-row" : ""}" tabindex="0" data-opick="${st.id}"><span class="num">${st.id}</span><span class="t">${esc(st.text)}<br><span class="small mute">${esc(st.place || "New this round")} · ${st.sources.length} idea${st.sources.length === 1 ? "" : "s"}</span></span>${shapeTag(st)}${st.isNew ? '<span class="tag you">new</span>' : ""}</li>`).join("")}</ul></div>`).join("")}</section>`;
    return h;
  }

  // ---------- how it works ----------
  function howPanel() {
    return `<section><h2>How it works</h2>
      <p>PlaceVote joins two things that usually live apart: a map where residents say what should change and where (participatory GIS), and the pol.is method for finding consensus across a large group.</p>
      <ol class="steps">
        <li><b>Share ideas on the map.</b> Residents pin an idea to a spot, draw it along a route, mark out an area, or add a whole-area idea that covers the neighbourhood, such as a policy or how the Board works.</li>
        <li><b>Merge overlapping ideas, carefully.</b> Hundreds of scattered pins can't be voted on fairly, so ideas are merged, but only when three things line up: the same topic ("loos" and "toilets" count as the same), the same place (separate sites more than about 200 m apart stay separate), and the same direction (opposite views like "keep the park open at night" and "close it" never merge). Ideas aimed at a group of people, or where it's unclear whether they're for or against, are held for an officer. Residents can undo a merge they disagree with. This demo reads topics and direction with a built-in dictionary; the full version would use an AI model, with an officer approving its drafts.</li>
        <li><b>Everyone votes on the same list.</b> Agree, disagree or unsure. Because everyone sees the same statements, the votes can be compared.</li>
        <li><b>Find opinion groups.</b> The vote table is compressed to two dimensions (principal component analysis) and grouped with k-means. The number of groups is chosen by silhouette score, as pol.is does.</li>
        <li><b>Find common ground.</b> A statement counts as common ground only if <i>every</i> group tends to agree, so a large group can't outvote a small one.</li>
        <li><b>Map it.</b> Each group's distinctive views are tied to places, giving the Board a spatial signature: not just what people agree on, but where.</li></ol></section>
      <section class="card"><h3>What's real and what's simulated</h3>
        <p>The maths runs live in your browser. The ${NRES} residents are simulated: three hidden groups with different leanings, plus random noise. The system has to rediscover those groups without being told about them. Your own votes are placed onto the same opinion map.</p></section>
      <section><h3>Limits to be honest about</h3>
        <ul><li>People who take part choose to; the groups describe opinion patterns, not the whole population.</li>
        <li>Whoever writes the merged statements has framing power, so that step must be open to challenge.</li>
        <li>Agreement in principle is not a budget. Common ground feeds a costing and prioritisation step; it doesn't replace one.</li></ul></section>
      <section><h3>Why a Neighbourhood Board would use it</h3>
        <p>Boards need a defensible, shared list of local priorities, and evidence of where views differ, not just a pile of survey comments. PlaceVote produces both, in a form that can go straight into a Board paper.</p></section>`;
  }

  // ---------- render + events ----------
  function render() {
    document.querySelectorAll("#tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === S.tab));
    $("#voteCount").textContent = Object.keys(S.votes).length;
    const P = $("#panel");
    P.innerHTML = S.tab === "ideas" ? ideasPanel() : S.tab === "vote" ? votePanel() : S.tab === "results" ? resultsPanel() : S.tab === "officer" ? officerPanel() : howPanel();
    drawPins();
    if (S.tab === "results") scatter();
  }

  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    S.tab = b.dataset.tab; S.adding = false; S.draft = null; S.sel = null; S.voteId = null; render();
  });

  $("#panel").addEventListener("input", e => { if (e.target.id === "idea") S.text = e.target.value; if (e.target.id === "cat") S.cat = e.target.value; });
  $("#panel").addEventListener("change", e => { if (e.target.id === "cat") S.cat = e.target.value; });

  $("#panel").addEventListener("click", e => {
    const t = e.target.closest("[data-act],[data-vote],[data-pick],[data-votepick],[data-rpick],[data-opick],[data-view],[data-mode]"); if (!t) return;
    const d = t.dataset;
    if (d.vote !== undefined) return castVote(+d.vote);
    if (d.pick) { S.sel = +d.pick; S.outcome = null; render(); return; }
    if (d.votepick) { S.voteId = +d.votepick; render(); return; }
    if (d.opick) { S.sel = S.sel === +d.opick ? null : +d.opick; render(); return; }
    if (d.rpick) { S.sel = S.sel === +d.rpick ? null : +d.rpick; drawPins(); return; }
    if (d.view !== undefined) { S.view = +d.view; render(); return; }
    if (d.mode) {
      const keep = S.draft.pts, t = d.mode;
      S.draft = { type: t, pts: t === "wide" ? [] : t === "point" ? keep.slice(0, 1) : keep.slice() };
      render();
      if (t !== "wide" && window.innerWidth <= 860 && !S.draft.pts.length) map.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    switch (d.act) {
      case "add":
        S.adding = true; S.draft = { type: "point", pts: [] }; S.sel = null; S.outcome = null; render();
        if (window.innerWidth <= 860) map.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "cancel": S.adding = false; S.draft = null; render(); break;
      case "submit": submitIdea(); break;
      case "dispute": dispute(); break;
      case "close": S.sel = null; render(); break;
      case "voteon": S.tab = "vote"; S.voteId = +d.id; S.sel = null; S.outcome = null; render(); break;
      case "tab": S.tab = d.tab; render(); break;
      case "copy": {
        const msg = $("#copied");
        try { navigator.clipboard.writeText(report()).then(() => { msg.textContent = "Copied."; }, () => { msg.textContent = "Couldn't copy: select the text above instead."; }); }
        catch (err) { msg.textContent = "Couldn't copy: select the text above instead."; }
        break;
      }
      case "reset":
        if (t.dataset.confirm) { S.votes = {}; S.mine = []; S.extra = []; S.outcome = null; save(); render(); }
        else { t.dataset.confirm = "1"; t.textContent = "Tap again to clear"; }
        break;
    }
  });
  $("#panel").addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("row")) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener("keydown", e => {
    if (S.tab !== "vote" || /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === "a") castVote(1); else if (e.key === "d") castVote(-1); else if (e.key === "u") castVote(0);
  });
  new ResizeObserver(() => { if (S.tab === "results") scatter(); }).observe($("#panel"));

  render();
}
