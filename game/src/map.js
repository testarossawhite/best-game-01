// STARFORGE DEFENSE — the map: the winding path, the build plots and the
// Starforge core. Pure geometry helpers; no game state lives here.
import { PATH_POINTS, PLOTS, CORE } from './config.js';

// Precomputed path segments with lengths, so enemies can walk the road.
export const SEGMENTS = [];
let total = 0;
for (let i = 0; i < PATH_POINTS.length - 1; i++) {
  const a = PATH_POINTS[i];
  const b = PATH_POINTS[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEGMENTS.push({ a, b, len, start: total });
  total += len;
}
export const PATH_LENGTH = total;

export function pathPointAt(distance) {
  const d = Math.max(0, Math.min(distance, PATH_LENGTH - 0.001));
  for (const seg of SEGMENTS) {
    if (d <= seg.start + seg.len) {
      const t = (d - seg.start) / seg.len;
      return {
        x: seg.a.x + (seg.b.x - seg.a.x) * t,
        y: seg.a.y + (seg.b.y - seg.a.y) * t,
        angle: Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x),
      };
    }
  }
  const last = SEGMENTS[SEGMENTS.length - 1];
  return { x: last.b.x, y: last.b.y, angle: 0 };
}

export function plots() {
  return PLOTS;
}

export function core() {
  return CORE;
}

// Distance from a point to the nearest path segment (used to keep plots
// clear of the road and to aim mortar shells).
export function distanceToPath(x, y) {
  let best = Infinity;
  for (const seg of SEGMENTS) {
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((x - seg.a.x) * dx + (y - seg.a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = seg.a.x + dx * t;
    const py = seg.a.y + dy * t;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}
