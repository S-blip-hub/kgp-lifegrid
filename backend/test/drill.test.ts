import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { DEFAULT_DRILL, runDrill } from "../src/simulate.js";
import type { Layout } from "../src/simulate.js";

const layout = JSON.parse(readFileSync(new URL("../../data/pilot_layout.json", import.meta.url), "utf8")) as Layout;

test("every drill case ends in verified closure", () => {
  const { book, metrics } = runDrill(layout, DEFAULT_DRILL);
  assert.equal(metrics.verified_closure_pct, 100);
  for (const c of book.cases) {
    assert.equal(c.status, "closed");
    assert.ok(c.safeAt !== undefined && c.closedAt! >= c.safeAt);
    assert.ok(c.followUps.every((f) => f.doneAt !== undefined));
  }
});

test("drills are reproducible for a seed", () => {
  const a = runDrill(layout, { ...DEFAULT_DRILL, seed: 3 }).metrics;
  const b = runDrill(layout, { ...DEFAULT_DRILL, seed: 3 }).metrics;
  assert.deepEqual(a, b);
});

test("missed pickups are escalated rather than left open", () => {
  const { metrics } = runDrill(layout, { ...DEFAULT_DRILL, missRate: 0.5 });
  assert.ok(metrics.escalations > 0);
  assert.equal(metrics.verified_closure_pct, 100);
});
