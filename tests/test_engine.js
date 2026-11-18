// Run with: node tests/test_engine.js
const assert = require("assert");
const D = require("../src/data.js");
const E = require("../src/engine.js");

let passed = 0;
function test(name, fn) { fn(); passed++; console.log("ok -", name); }

const sim = E.simulate(D.groupSpec, 7);
const res = E.analyse(sim.votes);

test("simulates the right number of residents and statements", () => {
  assert.strictEqual(sim.votes.length, D.groupSpec.reduce((a, g) => a + g.n, 0));
  assert.strictEqual(sim.votes[0].length, D.statements.length);
});

test("finds between 2 and 4 opinion groups", () => {
  assert.ok(res.k >= 2 && res.k <= 4, "k=" + res.k);
});

// How well do discovered groups match the hidden ones? (purity)
let purity = 0;
for (let g = 0; g < res.k; g++) {
  const counts = {};
  res.labels.forEach((l, i) => { if (l === g) counts[sim.truth[i]] = (counts[sim.truth[i]] || 0) + 1; });
  purity += Math.max(0, ...Object.values(counts));
}
purity /= sim.votes.length;

test("rediscovers the hidden groups reasonably well (purity > 0.75)", () => {
  assert.ok(purity > 0.75, "purity=" + purity.toFixed(2));
});

const ids = i => D.statements[i].id;
test("towpath lighting, youth hub, GP hours and publishing decisions come out as common ground", () => {
  const cons = res.consensus.map(s => ids(s.index));
  [1, 5, 10, 15].forEach(id => assert.ok(cons.includes(id), "missing " + id + " in " + cons));
});
test("low-traffic neighbourhood and parking bays come out as divisive", () => {
  const div = res.divisive.map(s => ids(s.index));
  [2, 3].forEach(id => assert.ok(div.includes(id), "missing " + id + " in " + div));
});

const stmts = D.statements.map(s => ({ ...s, sources: D.raw.filter(r => r[0] === s.id).map(r => r[3]) }));
test("a new towpath comment near the canal merges into statement 1", () => {
  const r = E.consolidate({ x: 600, y: 285, text: "the canal path is so dark at night, needs proper lights" }, stmts);
  assert.strictEqual(r.action, "merge"); assert.strictEqual(r.match.id, 1);
});
test("a new bins comment becomes a new statement", () => {
  const r = E.consolidate({ x: 300, y: 560, text: "more bins and a weekly litter pick by the bus stops" }, stmts);
  assert.strictEqual(r.action, "new", JSON.stringify(r.match));
});
test("an idea inside the low-traffic area merges into statement 2", () => {
  const r = E.consolidate({ x: 300, y: 150, text: "stop the rat run traffic through the terraces" }, stmts);
  assert.strictEqual(r.match.id, 2); assert.strictEqual(r.action, "merge");
});
test("a route drawn along the canal to the station merges into the cycle route", () => {
  const r = E.consolidate({ geom: { type: "line", pts: [[455, 500], [455, 390], [650, 255], [715, 120]] }, text: "safe bike route up to the train station" }, stmts);
  assert.strictEqual(r.match.id, 4); assert.strictEqual(r.action, "merge");
});
test("a whole-area idea about publishing decisions merges into statement 15", () => {
  const r = E.consolidate({ geom: { type: "wide" }, text: "the board should publish its decisions and budget online" }, stmts);
  assert.strictEqual(r.match.id, 15); assert.strictEqual(r.action, "merge");
});
test("a whole-area idea about a new topic becomes a new statement", () => {
  const r = E.consolidate({ geom: { type: "wide" }, text: "hold a quarterly public meeting in the evening so workers can come" }, stmts);
  assert.strictEqual(r.action, "new", JSON.stringify(r.match));
});
test("'car park' and 'retail park' don't count as green space", () => {
  const r = E.consolidate({ geom: { type: "area", pts: [[860, 480], [970, 480], [970, 600], [860, 600]] }, text: "Turn part of the retail park car park into a pump track for teenagers" }, stmts);
  assert.strictEqual(r.action, "new", JSON.stringify(r.match));
});
test("shape distance: inside an area is zero, whole-area has no distance", () => {
  const area = { type: "area", pts: [[0, 0], [100, 0], [100, 100], [0, 100]] };
  assert.strictEqual(E.shapeDistance(area, { type: "point", pts: [[50, 50]] }), 0);
  assert.strictEqual(E.shapeDistance(area, { type: "wide", pts: [] }), null);
  assert.ok(Math.abs(E.shapeDistance({ type: "line", pts: [[0, 0], [100, 0]] }, { type: "point", pts: [[50, 30]] }) - 30) < 1);
});
test("tidy and moderation behave", () => {
  assert.strictEqual(E.tidy("we need more benches in the park"), "More benches in the park.");
  assert.ok(E.moderate("ok"));
  assert.ok(E.moderate("my number is 07700 900123 call me"));
  assert.strictEqual(E.moderate("A bench at the top of Station Road would help older people."), null);
});

console.log(`\n${passed} tests passed. k=${res.k}, sizes=${res.sizes}, silhouette=${res.silhouette.toFixed(2)}, purity=${purity.toFixed(2)}`);
console.log("consensus:", res.consensus.map(s => ids(s.index)).join(","), " divisive:", res.divisive.map(s => ids(s.index)).join(","));
