// Drill simulation for the pilot: generates alerts at the five pilot nodes,
// sends them through the frame codec and the case book, models responders
// accepting, travelling and confirming safety, and reports the pilot metrics
// (acknowledgement time, verified closure, follow-up completion).
//
//   node dist/src/simulate.js --seed 7 --sessions 12

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { analytics, viewFor } from "./access.js";
import { encodeFrame, parseFrame } from "./frame.js";
import { CaseBook } from "./lifecycle.js";
import { RULES, travelSeconds } from "./routing.js";
import type { Case, Category, LifeNodeSite, Responder } from "./types.js";

export interface Layout {
  nodes: LifeNodeSite[];
  responders: Responder[];
}

export interface DrillConfig {
  seed: number;
  sessions: number;
  alertsPerSession: number;
  missRate: number; // share of assignments the first responder does not pick up in time
  duplicateRate: number; // share of alerts followed by a repeat press
  falseAlarmRate: number;
  followUpOnTime: number; // share of follow-ups done within two hours of falling due
}

export const DEFAULT_DRILL: DrillConfig = {
  seed: 7,
  sessions: 12,
  alertsPerSession: 10,
  missRate: 0.08,
  duplicateRate: 0.15,
  falseAlarmRate: 0.1,
  followUpOnTime: 0.92,
};

const MIX: [Category, number][] = [
  ["MED", 0.28], ["FGT", 0.18], ["HAR", 0.14], ["HAZ", 0.1], ["CRS", 0.15], ["UNS", 0.15],
];
const SESSION_HOURS = [10, 16, 21];

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Job {
  t: number;
  run: () => void;
}

export interface DrillResult {
  book: CaseBook;
  framesSent: number;
  framesRejected: number;
  metrics: Record<string, number>;
}

export function runDrill(layout: Layout, cfg: DrillConfig = DEFAULT_DRILL): DrillResult {
  const rand = rng(cfg.seed);
  const uniform = (a: number, b: number) => a + (b - a) * rand();
  const lognormal = (median: number, sigma: number) => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return median * Math.exp(sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  };
  const responders = layout.responders.map((r) => ({ ...r }));
  const calls = new Map<string, number>();
  // dispatch notifies a responder as soon as they are given (or called about) a case,
  // and checks back when the acknowledgement limit runs out
  const book: CaseBook = new CaseBook(layout.nodes, responders, {
    onAssign: (c, _r, t) => {
      const call = (calls.get(c.id) ?? 0) + 1;
      calls.set(c.id, call);
      at(t, () => respond(c, t, call));
      const check = t + RULES[c.category].ackLimit + 1;
      at(check, () => book.tick(check));
    },
  });
  const sites = new Map(layout.nodes.map((n) => [n.id, n]));
  const queue: Job[] = [];
  const at = (t: number, run: () => void) => {
    let i = queue.length;
    while (i > 0 && queue[i - 1].t > t) i--;
    queue.splice(i, 0, { t, run });
  };
  let framesSent = 0;
  let framesRejected = 0;

  const pickCategory = (site: LifeNodeSite): Category => {
    let u = rand();
    for (const [c, w] of MIX) {
      const weight = site.highRisk && c === "CRS" ? w * 1.6 : w;
      if (u < weight) return c;
      u -= weight;
    }
    return "MED";
  };

  // the assigned responder either picks up or misses; a miss is caught by the escalation tick
  const respond = (c: Case, t: number, call: number) => {
    const r = c.assignee;
    if (!r || calls.get(c.id) !== call) return; // superseded by a later call
    if (c.category !== "UNS" && rand() < cfg.missRate) return;
    const responder = book.responder(r);
    const accepted = t + Math.min(lognormal(18, 0.5), 50);
    at(accepted, () => {
      if (book.get(c.id).assignee !== r || c.acknowledgedAt !== undefined) return;
      book.accept(c.id, r, accepted);
      const site = sites.get(c.nodeId)!;
      const arrive = c.category === "UNS" ? accepted + 5 : accepted + travelSeconds(responder, site) + uniform(15, 45);
      at(arrive, () => {
        book.reach(c.id, r, arrive);
        const safe = arrive + (c.category === "UNS" ? 5 : uniform(60, 300));
        at(safe, () => {
          book.confirmSafe(c.id, r, safe);
          if (c.category === "CRS") book.addCareNote(c.id, "counselling", "Drill: student met by counsellor; follow-up plan agreed.");
          if (rand() < cfg.falseAlarmRate) book.classify(c.id, "false_alarm", "CTRL", safe + 60);
          else book.classify(c.id, "genuine", "CTRL", safe + 60);
          const follow = book.get(c.id).followUps;
          follow.forEach((f, i) => {
            const done = f.dueAt + (rand() < cfg.followUpOnTime ? uniform(0, 7200) : uniform(4 * 3600, 10 * 3600));
            at(f.dueAt, () => book.tick(f.dueAt));
            at(done, () => {
              book.completeFollowUp(c.id, i, "CNS", done);
              if (book.get(c.id).followUps.every((x) => x.doneAt !== undefined)) book.close(c.id, "CTRL", done + 60);
            });
          });
          if (!follow.length) at(safe + 120, () => book.close(c.id, "CTRL", safe + 120));
        });
      });
    });
  };

  for (let s = 0; s < cfg.sessions; s++) {
    const start = s * 86_400 + SESSION_HOURS[s % SESSION_HOURS.length] * 3600;
    for (let k = 0; k < cfg.alertsPerSession; k++) {
      const t0 = start + uniform(0, 90 * 60);
      const site = layout.nodes[Math.floor(rand() * layout.nodes.length)];
      const category = pickCategory(site);
      const silent = category === "HAR" ? rand() < 0.7 : false;
      const presses = rand() < cfg.duplicateRate ? [t0, t0 + uniform(10, 60)] : [t0];
      presses.forEach((tp, i) =>
        at(tp, () => {
          framesSent += 1;
          const text = encodeFrame({ nodeId: site.id, category, seq: (s * 100 + k) % 65536, silent });
          try {
            const f = parseFrame(text);
            const c = book.ingest({ ...f, receivedAt: tp });
            if (i === 0) {
              const rule = RULES[c.category];
              const waitCheck = tp + rule.ackLimit + 1;
              const reachCheck = tp + rule.reachLimit + 1;
              at(waitCheck, () => book.tick(waitCheck));
              at(reachCheck, () => book.tick(reachCheck));
            }
          } catch {
            framesRejected += 1;
          }
        }),
      );
    }
  }

  while (queue.length) queue.shift()!.run();

  return { book, framesSent, framesRejected, metrics: metrics(book.cases, framesSent, framesRejected) };
}

function quantile(values: number[], q: number): number {
  if (!values.length) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  return v[lo] + (v[Math.ceil(pos)] - v[lo]) * (pos - lo);
}

const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

export function metrics(cases: Case[], framesSent: number, framesRejected: number): Record<string, number> {
  const serious = cases.filter((c) => c.category !== "UNS");
  const ack = serious.filter((c) => c.acknowledgedAt !== undefined).map((c) => c.acknowledgedAt! - c.openedAt);
  const reach = serious.filter((c) => c.reachedAt !== undefined).map((c) => c.reachedAt! - c.openedAt);
  const p1reach = serious.filter((c) => c.priority === 1 && c.reachedAt !== undefined).map((c) => c.reachedAt! - c.openedAt);
  const follow = cases.flatMap((c) => c.followUps);
  const onTime = follow.filter((f) => f.doneAt !== undefined && f.doneAt - f.dueAt <= 7200).length;
  const verified = cases.filter((c) => c.status === "closed" && c.safeAt !== undefined).length;
  return {
    alerts: framesSent,
    frames_rejected: framesRejected,
    cases: cases.length,
    repeat_presses_merged: cases.reduce((a, c) => a + c.repeats, 0),
    transmission_success_pct: round((100 * (framesSent - framesRejected)) / Math.max(1, framesSent)),
    ack_median_s: round(quantile(ack, 0.5)),
    ack_p90_s: round(quantile(ack, 0.9)),
    ack_within_60s_pct: round((100 * ack.filter((x) => x <= 60).length) / Math.max(1, ack.length)),
    reach_median_s: round(quantile(reach, 0.5)),
    reach_p90_priority1_s: round(quantile(p1reach, 0.9)),
    escalations: cases.reduce((a, c) => a + c.events.filter((e) => e.type === "escalated").length, 0),
    verified_closure_pct: round((100 * verified) / Math.max(1, cases.length)),
    follow_ups: follow.length,
    follow_up_on_time_pct: round((100 * onTime) / Math.max(1, follow.length)),
    false_alarm_pct: round((100 * cases.filter((c) => c.outcome === "false_alarm").length) / Math.max(1, cases.length)),
  };
}

// ---------------------------------------------------------------- CLI

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "..", "..");
  const layout = JSON.parse(readFileSync(resolve(root, "data", "pilot_layout.json"), "utf8")) as Layout;
  const cfg: DrillConfig = {
    ...DEFAULT_DRILL,
    seed: Number(arg("seed", String(DEFAULT_DRILL.seed))),
    sessions: Number(arg("sessions", String(DEFAULT_DRILL.sessions))),
  };
  const { book, metrics: m } = runDrill(layout, cfg);
  const sites = new Map(layout.nodes.map((n) => [n.id, n]));

  const out = resolve(root, arg("out", "../outputs"));
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "metrics.json"), JSON.stringify(m, null, 2) + "\n");
  // the routing log carries no care notes: it is the control-room record
  const log = book.cases.map((c) => JSON.stringify({ ...c, careNotes: undefined })).join("\n");
  writeFileSync(resolve(out, "case_log.jsonl"), log + "\n");

  const dashboard = book.cases.map((c) => ({
    ...viewFor("control_room", c, sites)!,
    nodeId: c.nodeId,
    code: c.category,
    repeats: c.repeats,
    ack: c.acknowledgedAt !== undefined ? round(c.acknowledgedAt - c.openedAt) : null,
    reach: c.reachedAt !== undefined ? round(c.reachedAt - c.openedAt) : null,
    closedAfterH: c.closedAt !== undefined ? round((c.closedAt - c.openedAt) / 3600, 2) : null,
    outcome: c.outcome ?? null,
    followUps: c.followUps.map((f) => ({ label: f.label, late: f.doneAt === undefined || f.doneAt - f.dueAt > 7200 })),
    events: c.events.map((e) => ({ t: round(e.at - c.openedAt), type: e.type, by: e.by ?? "", note: e.note ?? "" })),
  }));
  const data = { config: cfg, metrics: m, nodes: layout.nodes, analytics: analytics(book.cases, sites), cases: dashboard };
  const target = resolve(root, arg("dashboard", "../dashboard/data.js"));
  writeFileSync(target, `window.LIFEGRID = ${JSON.stringify(data)};\n`);

  console.log(`drill: ${m.alerts} alerts -> ${m.cases} cases over ${cfg.sessions} sessions`);
  for (const [k, v] of Object.entries(m)) console.log(`  ${k.padEnd(26)} ${v}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
