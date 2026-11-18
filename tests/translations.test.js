import test from "node:test";
import assert from "node:assert/strict";
import { formatUzbekDate } from "../src/lib/translations.js";

test("formatUzbekDate spells out the month the way full-ICU Uzbek does", () => {
  assert.equal(formatUzbekDate(new Date(2026, 10, 16)), "16-noy, 2026");
  assert.equal(formatUzbekDate(new Date(2026, 0, 3)), "3-yan, 2026");
});

test("formatUzbekDate can lead with the weekday", () => {
  assert.equal(formatUzbekDate(new Date(2026, 10, 16), { weekday: true }), "dushanba, 16-noy, 2026");
  assert.equal(formatUzbekDate(new Date(2026, 10, 15), { weekday: true }), "yakshanba, 15-noy, 2026");
});
