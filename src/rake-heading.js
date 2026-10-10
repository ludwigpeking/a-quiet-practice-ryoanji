export const RAKE_HEADING_SMOOTHING_PIXELS = 7;

// Distance-based filtering behaves the same at different pointer event rates.
// A rake bar has no preferred end, so reversing never causes a 180-degree snap.
export function smoothRakeHeading(previousAngle, movementAngle, travelPixels) {
  let turnAngle = Math.atan2(Math.sin(movementAngle - previousAngle), Math.cos(movementAngle - previousAngle));
  if (turnAngle > Math.PI / 2) turnAngle -= Math.PI;
  if (turnAngle < -Math.PI / 2) turnAngle += Math.PI;
  const responseFraction = 1 - Math.exp(-travelPixels / RAKE_HEADING_SMOOTHING_PIXELS);
  return previousAngle + turnAngle * responseFraction;
}
