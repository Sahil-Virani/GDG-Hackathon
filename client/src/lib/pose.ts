export interface Landmark {
  x: number;
  y: number;
  visibility?: number;
}
export interface Guidance {
  valid: boolean;
  message: string;
  direction?: 'left' | 'right' | 'back' | 'closer';
  unavailable?: boolean;
}
export function framing(points: Landmark[]): Guidance {
  const visible = (i: number) =>
    points[i] &&
    (points[i].visibility ?? 0) > 0.5 &&
    points[i].x > 0.02 &&
    points[i].x < 0.98 &&
    points[i].y > 0.02 &&
    points[i].y < 0.98;
  if (!visible(0) || !visible(11) || !visible(12))
    return { valid: false, message: 'Step back — bring your outfit into frame', direction: 'back' };
  if (![23, 24, 25, 26, 27, 28].every(visible))
    return {
      valid: false,
      message: 'Step back — make sure your shoes are visible',
      direction: 'back',
    };
  const center = (points[11].x + points[12].x + points[23].x + points[24].x) / 4;
  // Preview is mirrored. Arrows follow the mirrored preview.
  if (center < 0.35) return { valid: false, message: 'Move a little left', direction: 'left' };
  if (center > 0.65) return { valid: false, message: 'Move a little right', direction: 'right' };
  const height = Math.max(points[27].y, points[28].y) - points[0].y;
  if (height < 0.43) return { valid: false, message: 'Come a little closer', direction: 'closer' };
  if (height > 0.92)
    return { valid: false, message: 'Give your look a little more space', direction: 'back' };
  return { valid: true, message: 'Looking good — hold that pose' };
}
