// STARFORGE DEFENSE 3D — the road: precomputed segments over the table
// plane so enemies march by distance and towers judge who is furthest.
import { PATH_POINTS } from './config.js';

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
      const t = seg.len === 0 ? 0 : (d - seg.start) / seg.len;
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
