// Shared types for the LifeGrid response backend.

export type Category = "MED" | "FGT" | "HAR" | "HAZ" | "CRS" | "UNS";

export const CATEGORY_LABEL: Record<Category, string> = {
  MED: "Medical / accident (MedAlert)",
  FGT: "Fight / violence (Raksha)",
  HAR: "Harassment / threat (Raksha)",
  HAZ: "Fire / electrical hazard (HazardGrid)",
  CRS: "Crisis support (Jeevan Kavach)",
  UNS: "Unsafe zone report (SafeRoute)",
};

export type Priority = 1 | 2 | 3;

export type Role =
  | "control_room"
  | "patrol"
  | "medical_desk"
  | "warden"
  | "counselling"
  | "admin";

/** Closed-loop status. A case only reaches "closed" after safety is confirmed by a person. */
export type Status = "received" | "assigned" | "reached" | "safe" | "follow_up" | "closed";

export interface Point {
  x: number;
  y: number;
}

export interface LifeNodeSite extends Point {
  id: string;
  label: string;
  zone: "hall" | "corridor";
  highRisk: boolean;
}

export interface Responder extends Point {
  id: string;
  role: Role;
  name: string;
  /** walking or riding speed in metres per second */
  speed: number;
  available: boolean;
}

export interface Alert {
  nodeId: string;
  category: Category;
  seq: number;
  silent: boolean;
  receivedAt: number; // seconds since the start of the drill
}

export interface CaseEvent {
  at: number;
  type:
    | "received"
    | "merged"
    | "assigned"
    | "accepted"
    | "escalated"
    | "reached"
    | "safe"
    | "follow_up_due"
    | "follow_up_done"
    | "closed"
    | "classified";
  by?: string;
  note?: string;
}

export interface Case {
  id: string;
  nodeId: string;
  category: Category;
  priority: Priority;
  silent: boolean;
  status: Status;
  openedAt: number;
  repeats: number;
  assignee?: string;
  notified: string[];
  acknowledgedAt?: number;
  reachedAt?: number;
  safeAt?: number;
  closedAt?: number;
  followUps: { dueAt: number; doneAt?: number; label: string }[];
  outcome?: "genuine" | "false_alarm" | "duplicate";
  /** details recorded by the counselling team; never shown to other roles */
  careNotes?: string;
  events: CaseEvent[];
}
