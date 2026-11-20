import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { analytics, viewFor } from "../src/access.js";
import { CaseBook, LifecycleError } from "../src/lifecycle.js";
import type { Layout } from "../src/simulate.js";

const layout = JSON.parse(readFileSync(new URL("../../data/pilot_layout.json", import.meta.url), "utf8")) as Layout;
const fresh = () => new CaseBook(layout.nodes, layout.responders.map((r) => ({ ...r })));
const sites = new Map(layout.nodes.map((n) => [n.id, n]));

test("a medical alert is assigned to the responder who can arrive first", () => {
  const book = fresh();
  const c = book.ingest({ nodeId: "H1-N1", category: "MED", seq: 1, silent: false, receivedAt: 0 });
  assert.equal(c.status, "assigned");
  assert.equal(c.assignee, "GD-H1"); // the gate guard is metres away
  assert.ok(c.notified.includes("MED"));
});

test("repeat presses join the open case instead of opening new ones", () => {
  const book = fresh();
  book.ingest({ nodeId: "CR-N4", category: "FGT", seq: 1, silent: false, receivedAt: 0 });
  book.ingest({ nodeId: "CR-N4", category: "FGT", seq: 2, silent: false, receivedAt: 40 });
  assert.equal(book.cases.length, 1);
  assert.equal(book.cases[0].repeats, 1);
  book.ingest({ nodeId: "CR-N4", category: "FGT", seq: 3, silent: false, receivedAt: 400 });
  assert.equal(book.cases.length, 2);
});

test("a case cannot close until safety is confirmed and follow-ups are done", () => {
  const book = fresh();
  const c = book.ingest({ nodeId: "H1-N3", category: "CRS", seq: 1, silent: false, receivedAt: 0 });
  assert.equal(c.priority, 1);
  assert.throws(() => book.close(c.id, "CTRL", 10), LifecycleError);
  assert.throws(() => book.confirmSafe(c.id, "x", 10), /after a responder reaches/);
  book.accept(c.id, c.assignee!, 15);
  book.reach(c.id, c.assignee!, 90);
  book.confirmSafe(c.id, c.assignee!, 300);
  assert.equal(c.status, "follow_up");
  assert.deepEqual(c.followUps.map((f) => f.label), ["same day", "24 h", "72 h"]);
  book.completeFollowUp(c.id, 0, "CNS", 400);
  assert.throws(() => book.close(c.id, "CTRL", 500), /24 h, 72 h follow-up pending/);
  assert.throws(() => book.completeFollowUp(c.id, 2, "CNS", 600), /not due yet/);
  book.completeFollowUp(c.id, 1, "CNS", 300 + 24 * 3600);
  book.completeFollowUp(c.id, 2, "CNS", 300 + 72 * 3600);
  book.close(c.id, "CTRL", 300 + 72 * 3600 + 60);
  assert.equal(c.status, "closed");
});

test("unacknowledged cases escalate and move to the next responder", () => {
  const book = fresh();
  const c = book.ingest({ nodeId: "CR-N5", category: "FGT", seq: 1, silent: false, receivedAt: 0 });
  const first = c.assignee;
  const raised = book.tick(61);
  assert.equal(raised.length, 1);
  assert.notEqual(c.assignee, first);
  assert.equal(book.responder(first!).available, true);
  assert.equal(book.tick(62).length, 0); // escalates once
});

test("false alarms are only classified after safety is secured", () => {
  const book = fresh();
  const c = book.ingest({ nodeId: "H1-N2", category: "HAZ", seq: 1, silent: true, receivedAt: 0 });
  assert.throws(() => book.classify(c.id, "false_alarm", "CTRL", 5), LifecycleError);
});

test("roles only see what they need", () => {
  const book = fresh();
  const crisis = book.ingest({ nodeId: "H1-N3", category: "CRS", seq: 1, silent: false, receivedAt: 0 });
  const medical = book.ingest({ nodeId: "H1-N1", category: "MED", seq: 2, silent: false, receivedAt: 5 });
  book.addCareNote(crisis.id, "counselling", "met in person");
  assert.throws(() => book.addCareNote(crisis.id, "patrol", "x"), LifecycleError);
  assert.equal(viewFor("counselling", crisis, sites)?.careNotes, "met in person");
  assert.equal(viewFor("patrol", crisis, sites)?.careNotes, undefined);
  assert.equal(viewFor("counselling", medical, sites), null);
  assert.equal(viewFor("medical_desk", crisis, sites), null);
  assert.equal(viewFor("admin", medical, sites), null);
  const a = analytics(book.cases, sites);
  assert.equal(a.byCategory.CRS, 1);
  assert.equal(JSON.stringify(a).includes("met in person"), false);
});
