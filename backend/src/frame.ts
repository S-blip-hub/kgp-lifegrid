// Parser for LifeNode alert frames: "LG1;<node>;<category>;<seq>;<silent>*<crc>".
// The CRC matches firmware/src/lifenode.cpp (CRC-8, polynomial 0x07, init 0x00).

import type { Category } from "./types.js";

const CATEGORIES: readonly Category[] = ["MED", "FGT", "HAR", "HAZ", "CRS", "UNS"];

export interface ParsedFrame {
  nodeId: string;
  category: Category;
  seq: number;
  silent: boolean;
}

export class FrameError extends Error {}

export function crc8(text: string): number {
  let crc = 0;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function encodeFrame(f: ParsedFrame): string {
  const body = `LG1;${f.nodeId};${f.category};${f.seq};${f.silent ? 1 : 0}`;
  return `${body}*${crc8(body).toString(16).toUpperCase().padStart(2, "0")}`;
}

export function parseFrame(text: string): ParsedFrame {
  const star = text.lastIndexOf("*");
  if (star < 0) throw new FrameError("missing checksum");
  const body = text.slice(0, star);
  const sent = Number.parseInt(text.slice(star + 1), 16);
  if (Number.isNaN(sent) || sent !== crc8(body)) throw new FrameError("checksum mismatch");

  const parts = body.split(";");
  if (parts.length !== 5 || parts[0] !== "LG1") throw new FrameError("unknown frame layout");
  const [, nodeId, cat, seqText, silentText] = parts;
  if (!/^[A-Z0-9-]{2,12}$/.test(nodeId)) throw new FrameError(`bad node id ${nodeId}`);
  if (!CATEGORIES.includes(cat as Category)) throw new FrameError(`unknown category ${cat}`);
  const seq = Number(seqText);
  if (!Number.isInteger(seq) || seq < 0 || seq > 65535) throw new FrameError(`bad sequence ${seqText}`);
  if (silentText !== "0" && silentText !== "1") throw new FrameError("bad silent flag");
  return { nodeId, category: cat as Category, seq, silent: silentText === "1" };
}
