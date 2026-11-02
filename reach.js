// Simple orbital estimates for the reach tool. Pure functions, no DOM.
// A desk estimate of plane and altitude change only; see README for what it leaves out.

export const MU_KM3_S2 = 398600.4418;
export const EARTH_RADIUS_KM = 6378.137;
export const J2 = 1.08263e-3;
// Sun-synchronous planes advance with the Sun: 360 degrees per year.
export const SUN_RATE_DEG_DAY = 0.9856;
// Finer steps change counts by very little and cost more on every slider move.
export const SCAN_STEP_DAYS = 5;
export const DAYS_PER_YEAR = 365;

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

export function circularSpeedKmS(hKm) {
  return Math.sqrt(MU_KM3_S2 / (EARTH_RADIUS_KM + hKm));
}

/** Inclination that makes a circular orbit at this altitude sun-synchronous. */
export function sunSyncInclinationDeg(hKm) {
  const a = EARTH_RADIUS_KM + hKm;
  const n = Math.sqrt(MU_KM3_S2 / a ** 3);
  const required = rad(SUN_RATE_DEG_DAY) / 86400;
  return deg(Math.acos(-required / (1.5 * J2 * (EARTH_RADIUS_KM / a) ** 2 * n)));
}

/** Angle between two orbit planes, in degrees. */
export function planeAngleDeg(i1, raan1, i2, raan2) {
  const c =
    Math.cos(rad(i1)) * Math.cos(rad(i2)) +
    Math.sin(rad(i1)) * Math.sin(rad(i2)) * Math.cos(rad(raan1 - raan2));
  return deg(Math.acos(Math.max(-1, Math.min(1, c))));
}

/** One-way speed change in m/s to match a target's plane and altitude from the station. */
export function transferMS(sat, satRaan, station, stationRaan) {
  const altitude = Math.abs(circularSpeedKmS(station.h) - circularSpeedKmS(sat.h));
  const theta = rad(planeAngleDeg(sat.i, satRaan, station.i, stationRaan));
  const plane = 2 * circularSpeedKmS(station.h) * Math.sin(theta / 2);
  return Math.hypot(altitude, plane) * 1000;
}

/** Local time (hours) a plane crosses the equator northbound, given the Sun's position. */
export function nodeLocalTime(raan, sunRaDeg) {
  return (((raan - sunRaDeg) / 15 + 12) % 24 + 24) % 24;
}

export function stationAt(hKm, nodeHours, sunRaDeg) {
  return {
    h: hKm,
    i: sunSyncInclinationDeg(hKm),
    raan: (((sunRaDeg + (nodeHours - 12) * 15) % 360) + 360) % 360,
  };
}

/**
 * For one satellite: the cheapest transfer inside the window, and the first day
 * the transfer drops within budget (null if it never does).
 */
export function reachOf(sat, station, budgetMS, years) {
  const lastDay = years * DAYS_PER_YEAR;
  let bestMS = Infinity;
  let firstDay = null;
  for (let day = 0; day <= lastDay; day += SCAN_STEP_DAYS) {
    const satRaan = sat.raan + sat.rate * day;
    const stationRaan = station.raan + SUN_RATE_DEG_DAY * day;
    const ms = transferMS(sat, satRaan, station, stationRaan);
    if (ms < bestMS) bestMS = ms;
    if (firstDay === null && ms <= budgetMS) firstDay = day;
  }
  return { bestMS, firstDay };
}

/** Every satellite within budget, with its first chance, soonest first. */
export function reachable(sats, station, budgetMS, years) {
  const out = [];
  for (const sat of sats) {
    const r = reachOf(sat, station, budgetMS, years);
    if (r.firstDay !== null) out.push({ ...sat, bestMS: r.bestMS, firstDay: r.firstDay });
  }
  return out.sort((a, b) => a.firstDay - b.firstDay || a.bestMS - b.bestMS);
}
