import {
  Cartesian3,
  JulianDate,
  Simon1994PlanetaryPositions,
  Transforms,
  Matrix3,
} from "cesium";
import type { ArtemisViewMode } from "@/types";

// ── Mission Constants ──────────────────────────────────────────
export const ARTEMIS_LAUNCH_UTC = new Date("2026-04-01T22:35:00Z");
export const ARTEMIS_SPLASHDOWN_UTC = new Date("2026-04-11T22:00:00Z"); // ~10 days
export const ARTEMIS_MISSION_DURATION_MS =
  ARTEMIS_SPLASHDOWN_UTC.getTime() - ARTEMIS_LAUNCH_UTC.getTime();

export const ARTEMIS_CREW = [
  { name: "Reid Wiseman", role: "Commander" },
  { name: "Victor Glover", role: "Pilot" },
  { name: "Christina Koch", role: "Mission Specialist 1" },
  { name: "Jeremy Hansen", role: "Mission Specialist 2 (CSA)" },
];

export const ARTEMIS_STREAM_URL = "https://www.youtube.com/NASA";

// ── Mission Profile (free-return trajectory) ───────────────────
// Artemis II follows a free-return lunar flyby:
//   Day 0     : Launch from KSC (28.5°N, 80.6°W)
//   Day 0-0.5 : Earth parking orbit (1-2 revs at ~185 km)
//   Day 0.5   : Trans-Lunar Injection (TLI) burn
//   Day 0.5-4 : Translunar coast (~380,000 km)
//   Day 4     : Lunar flyby — closest approach ~100 km behind Moon
//   Day 4-9   : Free-return coast back to Earth
//   Day 10    : Re-entry & splashdown in Pacific Ocean

// ── Milestone definitions ──────────────────────────────────────
export interface TrajectoryMilestone {
  /** Normalized mission time 0–1 */
  t: number;
  label: string;
  /** Short label for the marker */
  shortLabel: string;
}

export const MILESTONES: TrajectoryMilestone[] = [
  { t: 0.0,  label: "Launch — KSC",                shortLabel: "Launch" },
  { t: 0.05, label: "Trans-Lunar Injection",        shortLabel: "TLI" },
  { t: 0.40, label: "Closest Lunar Approach",       shortLabel: "Lunar Flyby" },
  { t: 0.70, label: "Free-Return Midcourse",        shortLabel: "Return" },
  { t: 1.0,  label: "Splashdown — Pacific Ocean",   shortLabel: "Splashdown" },
];

// ── Utility Functions ──────────────────────────────────────────

/** Mission elapsed time in milliseconds */
export function getMissionElapsedMs(now: Date = new Date()): number {
  return now.getTime() - ARTEMIS_LAUNCH_UTC.getTime();
}

/** Format MET as D:HH:MM:SS */
export function formatMET(now: Date = new Date()): string {
  const ms = getMissionElapsedMs(now);
  if (ms < 0) return "T-" + formatDuration(-ms);
  return "T+" + formatDuration(ms);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Check if the mission is currently active */
export function isMissionActive(now: Date = new Date()): boolean {
  return now >= ARTEMIS_LAUNCH_UTC && now <= ARTEMIS_SPLASHDOWN_UTC;
}

/** Check if the mission has completed */
export function isMissionComplete(now: Date = new Date()): boolean {
  return now > ARTEMIS_SPLASHDOWN_UTC;
}

/**
 * Get Moon position in Earth-fixed (ECEF) frame at a given time.
 */
export function getMoonPositionECEF(date: Date): Cartesian3 {
  const julianDate = JulianDate.fromDate(date);
  const moonECI = Simon1994PlanetaryPositions.computeMoonPositionInEarthInertialFrame(julianDate);
  const transform = Transforms.computeTemeToPseudoFixedMatrix(julianDate);
  if (!transform) return moonECI;
  return Matrix3.multiplyByVector(transform, moonECI, new Cartesian3());
}

/**
 * Get the approximate distance from Earth to Moon in km.
 */
export function getMoonDistanceKm(date: Date = new Date()): number {
  const moonPos = getMoonPositionECEF(date);
  return Cartesian3.magnitude(moonPos) / 1000;
}

// ── Free-Return Trajectory Model ───────────────────────────────
//
// Models the trajectory as a smooth spline through waypoints defined
// in a Moon-relative coordinate frame:
//   - "along" axis: Earth → Moon direction
//   - "perp" axis: perpendicular in the orbital plane (cross with Z)
//   - "up" axis: cross of along × perp (roughly polar)
//
// The trajectory forms a figure-8 loop:
//   Earth → straight out toward Moon → loop behind Moon → return
//   with the return path offset to one side (not retracing outbound).

/** Catmull-Rom–style cubic interpolation between waypoints */
function catmullRomSegment(
  p0: number, p1: number, p2: number, p3: number, t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Waypoints defining the free-return trajectory in normalized
 * Moon-frame coordinates (along, perp).
 * along: 0 = Earth center, 1 = Moon center
 * perp: lateral offset (positive = "south" side of trajectory plane)
 *
 * These are tuned to match NASA's official free-return diagram.
 */
const WAYPOINTS: { t: number; along: number; perp: number }[] = [
  // Launch & parking orbit (near Earth)
  { t: 0.00,  along: 0.017, perp:  0.000 },
  // TLI — depart Earth
  { t: 0.05,  along: 0.04,  perp:  0.005 },
  // Outbound coast — slight curve toward approach angle
  { t: 0.10,  along: 0.12,  perp:  0.010 },
  { t: 0.20,  along: 0.35,  perp:  0.015 },
  { t: 0.30,  along: 0.60,  perp:  0.015 },
  // Approaching Moon
  { t: 0.35,  along: 0.82,  perp:  0.010 },
  // Closest approach — just past Moon, beginning the loop behind it
  { t: 0.40,  along: 1.003, perp: -0.002 },
  // Behind the Moon — the far-side loop
  { t: 0.43,  along: 1.015, perp: -0.020 },
  { t: 0.46,  along: 1.005, perp: -0.035 },
  { t: 0.49,  along: 0.985, perp: -0.035 },
  { t: 0.52,  along: 0.975, perp: -0.020 },
  // Departing Moon on the return path
  { t: 0.55,  along: 0.985, perp: -0.005 },
  // Return coast — offset from outbound path for figure-8 shape
  { t: 0.60,  along: 0.80,  perp: -0.025 },
  { t: 0.70,  along: 0.50,  perp: -0.040 },
  { t: 0.80,  along: 0.25,  perp: -0.035 },
  { t: 0.90,  along: 0.10,  perp: -0.020 },
  // Earth approach & splashdown
  { t: 0.95,  along: 0.04,  perp: -0.008 },
  { t: 1.00,  along: 0.017, perp:  0.000 },
];

/**
 * Interpolate position at normalized time t (0–1) using Catmull-Rom
 * spline through the waypoints.
 */
function interpolateTrajectory(t: number): { along: number; perp: number } {
  const clamped = Math.max(0, Math.min(1, t));

  // Find which segment we're in
  let idx = 0;
  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    if (clamped >= WAYPOINTS[i].t && clamped <= WAYPOINTS[i + 1].t) {
      idx = i;
      break;
    }
  }
  if (clamped >= WAYPOINTS[WAYPOINTS.length - 1].t) {
    idx = WAYPOINTS.length - 2;
  }

  const w0 = WAYPOINTS[Math.max(0, idx - 1)];
  const w1 = WAYPOINTS[idx];
  const w2 = WAYPOINTS[Math.min(WAYPOINTS.length - 1, idx + 1)];
  const w3 = WAYPOINTS[Math.min(WAYPOINTS.length - 1, idx + 2)];

  const segLen = w2.t - w1.t;
  const localT = segLen > 0 ? (clamped - w1.t) / segLen : 0;

  return {
    along: catmullRomSegment(w0.along, w1.along, w2.along, w3.along, localT),
    perp:  catmullRomSegment(w0.perp,  w1.perp,  w2.perp,  w3.perp,  localT),
  };
}

/**
 * Convert normalized (along, perp) coordinates to ECEF Cartesian3.
 * "along" is in the Earth→Moon direction, "perp" is perpendicular in the
 * trajectory plane.
 */
function trajectoryToECEF(
  along: number, perp: number, moonPos: Cartesian3
): Cartesian3 {
  const moonDist = Cartesian3.magnitude(moonPos);

  // along axis: Earth → Moon
  const alongDir = Cartesian3.normalize(moonPos, new Cartesian3());

  // perp axis: perpendicular in the orbital plane
  const zUp = new Cartesian3(0, 0, 1);
  const perpDir = Cartesian3.cross(alongDir, zUp, new Cartesian3());
  Cartesian3.normalize(perpDir, perpDir);

  // Position = along * moonDist * alongDir + perp * moonDist * perpDir
  const pos = new Cartesian3();
  Cartesian3.multiplyByScalar(alongDir, along * moonDist, pos);
  const perpOffset = Cartesian3.multiplyByScalar(perpDir, perp * moonDist, new Cartesian3());
  Cartesian3.add(pos, perpOffset, pos);

  return pos;
}

/**
 * Get the mission phase name for a given normalized time.
 */
function getPhaseForT(t: number, date: Date): string {
  if (t <= 0) return "Pre-Launch";
  if (t <= 0.03) return "Earth Parking Orbit";
  if (t <= 0.05) return "Trans-Lunar Injection";
  if (t <= 0.35) return "Translunar Coast";
  if (t <= 0.55) return "Lunar Flyby";
  if (t <= 0.90) return "Return Coast";
  if (t <= 0.98) return "Earth Approach";
  if (isMissionComplete(date)) return "Mission Complete — Splashdown";
  return "Re-Entry";
}

/**
 * Approximate Orion's position along the free-return trajectory.
 *
 * Uses a Catmull-Rom spline through waypoints that model NASA's
 * official free-return lunar flyby path. The trajectory forms a
 * figure-8 loop between Earth and Moon.
 */
export function getOrionPosition(date: Date = new Date()): {
  position: Cartesian3;
  distanceFromEarthKm: number;
  distanceFromMoonKm: number;
  phase: string;
} | null {
  const elapsed = getMissionElapsedMs(date);
  if (elapsed < 0) return null;

  const t = Math.min(elapsed / ARTEMIS_MISSION_DURATION_MS, 1.0);
  const moonPos = getMoonPositionECEF(date);

  const { along, perp } = interpolateTrajectory(t);
  const orionPos = trajectoryToECEF(along, perp, moonPos);

  const distFromEarth = Cartesian3.magnitude(orionPos) / 1000;
  const distFromMoon = Cartesian3.distance(orionPos, moonPos) / 1000;
  const phase = getPhaseForT(t, date);

  return {
    position: orionPos,
    distanceFromEarthKm: distFromEarth,
    distanceFromMoonKm: distFromMoon,
    phase,
  };
}

/**
 * Generate trajectory path points for rendering the full mission arc.
 * Returns points in ECEF at a reference time (for the Moon position).
 */
export function getArtemisTrajectoryPoints(
  date: Date = new Date(),
  numPoints = 500
): Cartesian3[] {
  const points: Cartesian3[] = [];
  const moonPos = getMoonPositionECEF(date);

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const { along, perp } = interpolateTrajectory(t);
    points.push(trajectoryToECEF(along, perp, moonPos));
  }

  return points;
}

/**
 * Get milestone positions for rendering labeled markers on the trajectory.
 */
export function getMilestonePositions(date: Date = new Date()): {
  milestone: TrajectoryMilestone;
  position: Cartesian3;
}[] {
  const moonPos = getMoonPositionECEF(date);

  return MILESTONES.map((milestone) => {
    const { along, perp } = interpolateTrajectory(milestone.t);
    return {
      milestone,
      position: trajectoryToECEF(along, perp, moonPos),
    };
  });
}

// ── View-specific trajectory functions ────────────────────────

/**
 * Generate an elliptical Earth parking/checkout orbit.
 * High elliptical orbit: ~185 km perigee, ~74,000 km apogee.
 * Inclination ~28.5° (KSC latitude).
 */
export function getEarthOrbitPoints(
  date: Date = new Date(),
  numPoints = 200
): Cartesian3[] {
  const EARTH_RADIUS = 6_371_000; // meters
  const PERIGEE = EARTH_RADIUS + 185_000;   // 185 km altitude
  const APOGEE  = EARTH_RADIUS + 74_000_000; // 74,000 km altitude (high orbit)
  const semiMajor = (PERIGEE + APOGEE) / 2;
  const ecc = (APOGEE - PERIGEE) / (APOGEE + PERIGEE);
  const inclination = 28.5 * Math.PI / 180;

  // Orient RAAN toward Moon so orbit departure looks continuous with TLI
  const moonPos = getMoonPositionECEF(date);
  const moonDir = Cartesian3.normalize(moonPos, new Cartesian3());
  const raan = Math.atan2(moonDir.y, moonDir.x);

  const points: Cartesian3[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * 2 * Math.PI;
    const r = semiMajor * (1 - ecc * ecc) / (1 + ecc * Math.cos(theta));

    // Orbit in perifocal frame
    const xP = r * Math.cos(theta);
    const yP = r * Math.sin(theta);

    // Rotate by inclination (around x-axis) then RAAN (around z-axis)
    const cosI = Math.cos(inclination), sinI = Math.sin(inclination);
    const cosR = Math.cos(raan), sinR = Math.sin(raan);

    const x1 = xP;
    const y1 = yP * cosI;
    const z1 = yP * sinI;

    const x = x1 * cosR - y1 * sinR;
    const y = x1 * sinR + y1 * cosR;
    const z = z1;

    points.push(new Cartesian3(x, y, z));
  }
  return points;
}

/**
 * Get trajectory points for the lunar transit view (Earth → Moon).
 * Covers t = 0.00 to 0.42 (launch through closest approach).
 */
export function getLunarTransitPoints(
  date: Date = new Date(),
  numPoints = 300
): Cartesian3[] {
  const moonPos = getMoonPositionECEF(date);
  const points: Cartesian3[] = [];
  const tStart = 0.00, tEnd = 0.42;

  for (let i = 0; i <= numPoints; i++) {
    const t = tStart + (i / numPoints) * (tEnd - tStart);
    const { along, perp } = interpolateTrajectory(t);
    points.push(trajectoryToECEF(along, perp, moonPos));
  }
  return points;
}

/**
 * Get trajectory points for the flyby & return view (Moon loop → Earth).
 * Covers t = 0.35 to 1.0 (approach, lunar loop, return, splashdown).
 */
export function getFlybyReturnPoints(
  date: Date = new Date(),
  numPoints = 400
): Cartesian3[] {
  const moonPos = getMoonPositionECEF(date);
  const points: Cartesian3[] = [];
  const tStart = 0.35, tEnd = 1.0;

  for (let i = 0; i <= numPoints; i++) {
    const t = tStart + (i / numPoints) * (tEnd - tStart);
    const { along, perp } = interpolateTrajectory(t);
    points.push(trajectoryToECEF(along, perp, moonPos));
  }
  return points;
}

/**
 * Get milestones filtered by the active view.
 */
export function getMilestonesForView(
  view: ArtemisViewMode,
  date: Date = new Date()
): { milestone: TrajectoryMilestone; position: Cartesian3 }[] {
  const moonPos = getMoonPositionECEF(date);

  const tRanges: Record<string, [number, number]> = {
    "earth-orbit":    [-0.01, 0.06],
    "lunar-transit":  [-0.01, 0.45],
    "flyby-return":   [0.30, 1.01],
  };

  const [tMin, tMax] = tRanges[view] || [0, 1];

  return MILESTONES
    .filter((m) => m.t >= tMin && m.t <= tMax)
    .map((milestone) => {
      const { along, perp } = interpolateTrajectory(milestone.t);
      return { milestone, position: trajectoryToECEF(along, perp, moonPos) };
    });
}
