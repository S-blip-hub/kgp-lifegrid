import assert from "node:assert/strict";
import { test } from "node:test";

import { FrameError, crc8, encodeFrame, parseFrame } from "../src/frame.js";

test("CRC-8 matches the reference check value and the firmware vectors", () => {
  assert.equal(crc8("123456789"), 0xf4);
  // same vectors as firmware/test/test_lifenode.cpp
  assert.equal(encodeFrame({ nodeId: "H1-N2", category: "MED", seq: 17, silent: false }), "LG1;H1-N2;MED;17;0*6B");
  assert.equal(encodeFrame({ nodeId: "CR-N4", category: "FGT", seq: 3, silent: true }), "LG1;CR-N4;FGT;3;1*90");
});

test("frames round-trip", () => {
  const f = { nodeId: "H1-N3", category: "CRS" as const, seq: 65535, silent: false };
  assert.deepEqual(parseFrame(encodeFrame(f)), f);
});

test("corrupted or malformed frames are rejected", () => {
  assert.throws(() => parseFrame("LG1;H1-N2;MED;17;0*6C"), FrameError);
  assert.throws(() => parseFrame("LG1;H1-N2;MED;17;0"), FrameError);
  const badCategory = "LG1;H1-N2;XYZ;1;0";
  assert.throws(() => parseFrame(`${badCategory}*${crc8(badCategory).toString(16)}`), /unknown category/);
});
