import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  circularSpeedKmS, planeAngleDeg, reachOf, reachable, stationAt, sunSyncInclinationDeg, transferMS,
} from "../reach.js";

const { meta, sats } = JSON.parse(readFileSync(new URL("../data/satellites.json", import.meta.url)));
const close = (a, b, tolerance) => assert.ok(Math.abs(a - b) <= tolerance, `${a} is not within ${tolerance} of ${b}`);

test("known orbital values", () => {
  close(sunSyncInclinationDeg(700), 98.19, 0.05);
  close(circularSpeedKmS(550), 7.585, 0.002);
  // A 1 degree plane change at 550 km costs about 132 m/s.
  const station = { h: 550, i: 50 };
  close(transferMS({ h: 550, i: 51 }, 0, station, 0), 132, 1);
});

test("same plane and altitude costs nothing", () => {
  const station = stationAt(700, 18, meta.sunRa);
  assert.equal(planeAngleDeg(98, 40, 98, 40), 0);
  close(transferMS({ h: 700, i: station.i }, station.raan, station, station.raan), 0, 0.01);
});

test("first chance is inside the window and never above budget", () => {
  const station = stationAt(700, 18, meta.sunRa);
  for (const sat of reachable(sats, station, 500, 5)) {
    assert.ok(sat.firstDay >= 0 && sat.firstDay <= 5 * 365);
    assert.ok(sat.bestMS <= 500);
  }
});

test("a longer wait or a bigger budget never loses a satellite", () => {
  const station = stationAt(700, 18, meta.sunRa);
  const count = (budget, years) => reachable(sats, station, budget, years).length;
  assert.ok(count(500, 1) <= count(500, 5));
  assert.ok(count(250, 5) <= count(500, 5));
});

test("an unreachable satellite reports no first chance", () => {
  const station = stationAt(700, 18, meta.sunRa);
  assert.equal(reachOf(sats[0], station, 0, 0).firstDay, null);
});

test("counts match an independent Python calculation on the same data", () => {
  const golden = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url)));
  for (const [key, expected] of Object.entries(golden)) {
    const [h, node, years, budget] = key.split("|").map(Number);
    const station = stationAt(h, node, meta.sunRa);
    assert.equal(reachable(sats, station, budget, years).length, expected, key);
  }
});
