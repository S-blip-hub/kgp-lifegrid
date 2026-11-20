// Closed-loop case book: every serious alert stays open until a person has
// reached the student and confirmed safety, and crisis cases also need their
// follow-up checks recorded before they can close.

import { RULES, effectivePriority, selectResponder } from "./routing.js";
import type { Alert, Case, CaseEvent, LifeNodeSite, Responder, Role } from "./types.js";

export class LifecycleError extends Error {}

export interface CaseBookOptions {
  /** repeat presses at the same node and category inside this window join the open case (seconds) */
  mergeWindow?: number;
  /** called whenever a responder is given a case, so dispatch can notify them */
  onAssign?: (c: Case, responderId: string, at: number) => void;
}

export class CaseBook {
  readonly cases: Case[] = [];
  private readonly sites: Map<string, LifeNodeSite>;
  private readonly responders: Map<string, Responder>;
  private readonly mergeWindow: number;
  private readonly onAssign?: CaseBookOptions["onAssign"];
  private readonly assignedAt = new Map<string, number>();
  private readonly reachEscalated = new Set<string>();

  constructor(sites: LifeNodeSite[], responders: Responder[], opts: CaseBookOptions = {}) {
    this.sites = new Map(sites.map((s) => [s.id, s]));
    this.responders = new Map(responders.map((r) => [r.id, r]));
    this.mergeWindow = opts.mergeWindow ?? 120;
    this.onAssign = opts.onAssign;
  }

  get(id: string): Case {
    const c = this.cases.find((x) => x.id === id);
    if (!c) throw new LifecycleError(`no case ${id}`);
    return c;
  }

  open(): Case[] {
    return this.cases.filter((c) => c.status !== "closed");
  }

  responder(id: string): Responder {
    const r = this.responders.get(id);
    if (!r) throw new LifecycleError(`no responder ${id}`);
    return r;
  }

  /** Turns an alert into a new case, or merges it into a matching open case. Never drops an alert. */
  ingest(alert: Alert): Case {
    const site = this.sites.get(alert.nodeId);
    if (!site) throw new LifecycleError(`unknown node ${alert.nodeId}`);

    const match = this.cases.find(
      (c) =>
        c.nodeId === alert.nodeId &&
        c.category === alert.category &&
        c.status !== "closed" &&
        alert.receivedAt - c.openedAt <= this.mergeWindow,
    );
    if (match) {
      match.repeats += 1;
      this.log(match, { at: alert.receivedAt, type: "merged", note: `repeat press, seq ${alert.seq}` });
      return match;
    }

    const rule = RULES[alert.category];
    const c: Case = {
      id: `LG-${String(this.cases.length + 1).padStart(4, "0")}`,
      nodeId: alert.nodeId,
      category: alert.category,
      priority: effectivePriority(alert.category, site),
      silent: alert.silent,
      status: "received",
      openedAt: alert.receivedAt,
      repeats: 0,
      notified: this.idsWithRoles(rule.notify),
      followUps: [],
      events: [],
    };
    this.cases.push(c);
    this.log(c, { at: alert.receivedAt, type: "received", note: `${site.label}${alert.silent ? " (silent)" : ""}` });
    if (rule.humanApproval) {
      this.log(c, { at: alert.receivedAt, type: "received", note: "crisis protocol: actions need approval by the counselling lead" });
    }
    this.assign(c, alert.receivedAt);
    return c;
  }

  private idsWithRoles(roles: Role[]): string[] {
    return [...this.responders.values()].filter((r) => roles.includes(r.role)).map((r) => r.id);
  }

  private assign(c: Case, at: number, exclude: ReadonlySet<string> = new Set(), quiet = false): boolean {
    const site = this.sites.get(c.nodeId)!;
    const r = selectResponder(site, c.category, [...this.responders.values()], exclude);
    if (!r) {
      if (!quiet) {
        this.log(c, { at, type: "escalated", by: "system", note: "no free responder: queued for the next one, control room alerted" });
      }
      return false;
    }
    const previous = c.assignee;
    r.available = false;
    c.assignee = r.id;
    c.status = "assigned";
    this.assignedAt.set(c.id, at);
    this.log(c, { at, type: "assigned", by: r.id });
    if (previous) this.release(previous, at);
    this.onAssign?.(c, r.id, at);
    return true;
  }

  /** Frees a responder and hands them the most urgent waiting case, if any. */
  private release(responderId: string, at: number): void {
    const r = this.responders.get(responderId);
    if (!r) return;
    r.available = true;
    const waiting = this.cases
      .filter((c) => c.status === "received" && c.assignee === undefined)
      .sort((a, b) => a.priority - b.priority || a.openedAt - b.openedAt);
    for (const c of waiting) {
      if (this.assign(c, at, new Set(), true)) break;
    }
  }

  accept(id: string, responderId: string, at: number): void {
    const c = this.get(id);
    if (c.assignee !== responderId) throw new LifecycleError(`${responderId} is not assigned to ${id}`);
    if (c.acknowledgedAt === undefined) c.acknowledgedAt = at;
    this.log(c, { at, type: "accepted", by: responderId });
  }

  reach(id: string, responderId: string, at: number): void {
    const c = this.get(id);
    if (c.acknowledgedAt === undefined) throw new LifecycleError(`${id} has not been accepted`);
    c.status = "reached";
    c.reachedAt = at;
    this.log(c, { at, type: "reached", by: responderId });
  }

  /** Safety is confirmed by the person on site. Only then can follow-up and closure start. */
  confirmSafe(id: string, by: string, at: number): void {
    const c = this.get(id);
    if (c.status !== "reached") throw new LifecycleError(`${id}: safety can only be confirmed after a responder reaches`);
    c.status = "safe";
    c.safeAt = at;
    this.log(c, { at, type: "safe", by });
    if (c.assignee) this.release(c.assignee, at);
    const hours = RULES[c.category].followUpHours;
    if (hours.length) {
      c.status = "follow_up";
      c.followUps = hours.map((h) => ({ dueAt: at + h * 3600, label: h === 0 ? "same day" : `${h} h` }));
    }
  }

  completeFollowUp(id: string, index: number, by: string, at: number): void {
    const c = this.get(id);
    const f = c.followUps[index];
    if (!f) throw new LifecycleError(`${id} has no follow-up ${index}`);
    if (at < f.dueAt - 3600) throw new LifecycleError(`${id}: ${f.label} follow-up is not due yet`);
    f.doneAt = at;
    this.log(c, { at, type: "follow_up_done", by, note: f.label });
  }

  /** Classification of false alarms happens only after safety is secured, so misuse never blocks help. */
  classify(id: string, outcome: NonNullable<Case["outcome"]>, by: string, at: number): void {
    const c = this.get(id);
    if (c.safeAt === undefined) throw new LifecycleError(`${id}: classify only after safety is confirmed`);
    c.outcome = outcome;
    this.log(c, { at, type: "classified", by, note: outcome });
  }

  close(id: string, by: string, at: number): void {
    const c = this.get(id);
    if (c.safeAt === undefined) throw new LifecycleError(`${id}: cannot close before safety is confirmed`);
    const pending = c.followUps.filter((f) => f.doneAt === undefined);
    if (pending.length) throw new LifecycleError(`${id}: ${pending.map((f) => f.label).join(", ")} follow-up pending`);
    c.status = "closed";
    c.closedAt = at;
    this.log(c, { at, type: "closed", by });
  }

  /** Counselling-only notes; other roles never see them (see access.ts). */
  addCareNote(id: string, role: Role, note: string): void {
    if (role !== "counselling") throw new LifecycleError("only the counselling team can record care notes");
    const c = this.get(id);
    c.careNotes = c.careNotes ? `${c.careNotes}\n${note}` : note;
  }

  /**
   * Time-based checks. An unacknowledged case escalates every time its
   * acknowledgement limit passes: to the next free responder if there is one,
   * otherwise the control room calls the current assignee again. A case that
   * is not reached in time goes to admin escalation. Due follow-ups are flagged.
   */
  tick(now: number): CaseEvent[] {
    const raised: CaseEvent[] = [];
    for (const c of this.open()) {
      const rule = RULES[c.category];
      if (c.acknowledgedAt === undefined) {
        const since = this.assignedAt.get(c.id) ?? c.openedAt;
        if (now - since > rule.ackLimit) {
          const previous = c.assignee;
          const note = `not acknowledged in ${rule.ackLimit} s`;
          if (this.assign(c, now, new Set(previous ? [previous] : []), true)) {
            raised.push(this.log(c, { at: now, type: "escalated", by: "system", note: `${note}: reassigned to ${c.assignee}` }));
          } else {
            this.assignedAt.set(c.id, now);
            raised.push(
              this.log(c, {
                at: now,
                type: "escalated",
                by: "system",
                note: previous ? `${note}: control room calling ${previous}` : `${note}: still waiting for a free responder`,
              }),
            );
            if (previous) this.onAssign?.(c, previous, now);
          }
        }
      }
      if (c.reachedAt === undefined && now - c.openedAt > rule.reachLimit && !this.reachEscalated.has(c.id)) {
        this.reachEscalated.add(c.id);
        raised.push(this.log(c, { at: now, type: "escalated", by: "system", note: "reach time exceeded: admin escalation" }));
      }
      for (const f of c.followUps) {
        const flagged = c.events.some((e) => e.type === "follow_up_due" && e.note === f.label);
        if (f.doneAt === undefined && now >= f.dueAt && !flagged) {
          raised.push(this.log(c, { at: now, type: "follow_up_due", note: f.label }));
        }
      }
    }
    return raised;
  }

  private log(c: Case, e: CaseEvent): CaseEvent {
    c.events.push(e);
    return e;
  }
}
