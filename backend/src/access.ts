// Role-based views. Each role sees the minimum it needs to act:
// security and wardens see location, category and status; the medical desk sees
// medical cases; counselling sees crisis cases including care notes; admin sees
// anonymised counts only.

import { CATEGORY_LABEL } from "./types.js";
import type { Case, Category, LifeNodeSite, Role } from "./types.js";

export interface OperationalView {
  id: string;
  node: string;
  category: string;
  priority: number;
  status: Case["status"];
  openedAt: number;
  assignee?: string;
  silent: boolean;
  careNotes?: string;
}

const SEES: Record<Role, (c: Case) => boolean> = {
  control_room: () => true,
  patrol: () => true,
  warden: (c) => c.category !== "UNS",
  medical_desk: (c) => c.category === "MED",
  counselling: (c) => c.category === "CRS",
  admin: () => false,
};

export function viewFor(role: Role, c: Case, sites: Map<string, LifeNodeSite>): OperationalView | null {
  if (!SEES[role](c)) return null;
  const view: OperationalView = {
    id: c.id,
    node: sites.get(c.nodeId)?.label ?? c.nodeId,
    category: CATEGORY_LABEL[c.category],
    priority: c.priority,
    status: c.status,
    openedAt: c.openedAt,
    assignee: c.assignee,
    silent: c.silent,
  };
  if (role === "counselling" && c.careNotes) view.careNotes = c.careNotes;
  return view;
}

export interface Analytics {
  byCategory: Partial<Record<Category, number>>;
  byZone: Record<string, number>;
  byHour: number[];
  falseAlarmShare: number;
}

/** Anonymised analytics for campus improvement: counts only, no case ids, people or notes. */
export function analytics(cases: Case[], sites: Map<string, LifeNodeSite>, dayStartHour = 0): Analytics {
  const byCategory: Partial<Record<Category, number>> = {};
  const byZone: Record<string, number> = {};
  const byHour = new Array(24).fill(0);
  let falseAlarms = 0;
  for (const c of cases) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    const zone = sites.get(c.nodeId)?.zone ?? "unknown";
    byZone[zone] = (byZone[zone] ?? 0) + 1;
    byHour[Math.floor(dayStartHour + (c.openedAt % 86_400) / 3600) % 24] += 1;
    if (c.outcome === "false_alarm") falseAlarms += 1;
  }
  return { byCategory, byZone, byHour, falseAlarmShare: cases.length ? falseAlarms / cases.length : 0 };
}
