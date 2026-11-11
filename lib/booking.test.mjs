// Unit tests for the free-slot calculation. Run: npm run test:unit
// (Node 23.6+ runs the .ts import directly.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, todayKey, tzOffsetMinutes, zonedToUtc, addDays } from "./booking.ts";

const TZ = "Asia/Baghdad"; // UTC+3, no daylight saving
const hours = { is_open: true, open_time: "10:00:00", close_time: "12:00:00", break_start: null, break_end: null };
// "now" = 2030-01-01 08:00 in Baghdad
const now = new Date("2030-01-01T05:00:00Z");
const base = {
  dateKey: "2030-01-02", timeZone: TZ, hours, isBlocked: false, durationMinutes: 30,
  intervalMinutes: 30, minNoticeMinutes: 60, maxDaysAhead: 30, busy: [], now,
};

test("Baghdad is UTC+3 and wall time converts to the right instant", () => {
  assert.equal(tzOffsetMinutes(now, TZ), 180);
  assert.equal(zonedToUtc("2030-01-02", "10:00", TZ).toISOString(), "2030-01-02T07:00:00.000Z");
  assert.equal(todayKey(TZ, new Date("2030-01-01T22:30:00Z")), "2030-01-02"); // 01:30 next day in Baghdad
  assert.equal(addDays("2030-01-31", 1), "2030-02-01");
});

test("open day gives every interval that fits before closing", () => {
  assert.deepEqual(computeSlots(base), ["10:00", "10:30", "11:00", "11:30"]);
  assert.deepEqual(computeSlots({ ...base, durationMinutes: 60 }), ["10:00", "10:30", "11:00"]);
});

test("closed, blocked, past and too-far days have no slots", () => {
  assert.deepEqual(computeSlots({ ...base, hours: { ...hours, is_open: false } }), []);
  assert.deepEqual(computeSlots({ ...base, isBlocked: true }), []);
  assert.deepEqual(computeSlots({ ...base, dateKey: "2029-12-31" }), []);
  assert.deepEqual(computeSlots({ ...base, dateKey: "2030-03-01" }), []);
});

test("minimum notice hides slots that are too soon (today)", () => {
  // now 08:00 + 150 min notice → first slot 10:30
  assert.deepEqual(computeSlots({ ...base, dateKey: "2030-01-01", minNoticeMinutes: 150 }), ["10:30", "11:00", "11:30"]);
});

test("existing bookings and breaks remove overlapping slots", () => {
  const busy = [{ starts_at: "2030-01-02T07:30:00Z", ends_at: "2030-01-02T08:00:00Z" }]; // 10:30–11:00 local
  assert.deepEqual(computeSlots({ ...base, busy }), ["10:00", "11:00", "11:30"]);
  const withBreak = { ...hours, break_start: "11:00", break_end: "11:30" };
  assert.deepEqual(computeSlots({ ...base, hours: withBreak }), ["10:00", "10:30", "11:30"]);
});
