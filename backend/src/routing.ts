// Category rules and location-aware responder selection.

import type { Category, LifeNodeSite, Point, Priority, Responder, Role } from "./types.js";

export interface Rule {
  priority: Priority;
  /** roles that can take ownership of the case, in order of preference */
  owners: Role[];
  /** roles informed when the case opens */
  notify: Role[];
  /** seconds allowed before an unacknowledged case escalates */
  ackLimit: number;
  /** seconds allowed from opening until a responder reaches the node */
  reachLimit: number;
  /** follow-up checks after safety is confirmed, in hours */
  followUpHours: number[];
  /** whether a person must approve every crisis action */
  humanApproval: boolean;
}

export const RULES: Record<Category, Rule> = {
  MED: { priority: 1, owners: ["patrol", "medical_desk"], notify: ["control_room", "medical_desk"], ackLimit: 60, reachLimit: 480, followUpHours: [], humanApproval: false },
  FGT: { priority: 1, owners: ["patrol"], notify: ["control_room", "warden"], ackLimit: 60, reachLimit: 420, followUpHours: [24], humanApproval: false },
  CRS: { priority: 1, owners: ["patrol", "warden"], notify: ["counselling", "control_room"], ackLimit: 60, reachLimit: 420, followUpHours: [0, 24, 72], humanApproval: true },
  HAR: { priority: 2, owners: ["patrol"], notify: ["control_room", "warden"], ackLimit: 90, reachLimit: 600, followUpHours: [24], humanApproval: false },
  HAZ: { priority: 2, owners: ["patrol"], notify: ["control_room"], ackLimit: 90, reachLimit: 600, followUpHours: [], humanApproval: false },
  UNS: { priority: 3, owners: ["control_room"], notify: [], ackLimit: 600, reachLimit: 86_400, followUpHours: [], humanApproval: false },
};

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y) * 1.3; // walking detour factor
}

export function travelSeconds(r: Responder, site: Point): number {
  return distance(r, site) / r.speed;
}

/**
 * Picks the available responder who can reach the node first, trying owner
 * roles in order. Returns undefined when nobody in those roles is free.
 */
export function selectResponder(
  site: LifeNodeSite,
  category: Category,
  responders: Responder[],
  exclude: ReadonlySet<string> = new Set(),
): Responder | undefined {
  for (const role of RULES[category].owners) {
    const free = responders.filter((r) => r.role === role && r.available && !exclude.has(r.id));
    if (free.length) {
      return free.reduce((best, r) => (travelSeconds(r, site) < travelSeconds(best, site) ? r : best));
    }
  }
  return undefined;
}

/** A high-risk-zone node raises crisis and fight alerts to the top of the queue. */
export function effectivePriority(category: Category, site: LifeNodeSite): Priority {
  const p = RULES[category].priority;
  return site.highRisk && (category === "CRS" || category === "FGT") ? 1 : p;
}
