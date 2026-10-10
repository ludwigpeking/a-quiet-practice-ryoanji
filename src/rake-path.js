// All input is already ray-projected onto the courtyard's y=0 plane. Smooth
// position and tangent in world X/Z, so perspective never distorts the rake's
// direction or its physical trailing distance. Two spatial filter stages
// reject quantized mouse steps without advancing while stationary.
const FILTER_DISTANCE_METERS = .28;
const SAMPLE_DISTANCE_METERS = .025;
const START_DISTANCE_METERS = .06;

export function planRakeContact(previousAngle, targetAngle, movementX, movementZ, hasMoved) {
  const turnAngle = Math.atan2(Math.sin(targetAngle - previousAngle), Math.cos(targetAngle - previousAngle));
  const forwardTravel = movementX * Math.cos(previousAngle) + movementZ * Math.sin(previousAngle);
  const shouldLift = hasMoved && (forwardTravel <= 0 || Math.abs(turnAngle) > Math.PI / 2);
  // A reversal is a lift and a fresh pull. Never sweep the teeth through the
  // surface while spinning the head 180 degrees or while pushing it backward.
  return { shouldLift, startAngle: hasMoved ? previousAngle : targetAngle, turnAngle: hasMoved && !shouldLift ? turnAngle : 0 };
}

export function createRakePath(worldX, worldZ) {
  return { startX: worldX, startZ: worldZ, previousX: worldX, previousZ: worldZ, firstX: worldX, firstZ: worldZ, secondX: worldX, secondZ: worldZ, started: false };
}

export function advanceRakePath(path, worldX, worldZ) {
  if (!path.started) {
    if (Math.hypot(worldX - path.startX, worldZ - path.startZ) < START_DISTANCE_METERS) return [];
    path.started = true;
  }
  const movementX = worldX - path.previousX;
  const movementZ = worldZ - path.previousZ;
  const travelMeters = Math.hypot(movementX, movementZ);
  if (travelMeters < .000001) return [];
  const sampleCount = Math.ceil(travelMeters / SAMPLE_DISTANCE_METERS);
  const distancePerSample = travelMeters / sampleCount;
  const decayFactor = Math.exp(-distancePerSample / FILTER_DISTANCE_METERS);
  const directionX = movementX / travelMeters;
  const directionZ = movementZ / travelMeters;
  const samples = [];
  let inputX = path.previousX, inputZ = path.previousZ;
  for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex++) {
    const nextX = path.previousX + movementX * sampleIndex / sampleCount;
    const nextZ = path.previousZ + movementZ * sampleIndex / sampleCount;
    // Exact integration for a linear input segment makes event subdivision
    // irrelevant, including fractional-pixel and coalesced pointer reports.
    const firstOffsetX = path.firstX - inputX + directionX * FILTER_DISTANCE_METERS;
    const firstOffsetZ = path.firstZ - inputZ + directionZ * FILTER_DISTANCE_METERS;
    path.secondX = nextX - 2 * directionX * FILTER_DISTANCE_METERS + (path.secondX - inputX + 2 * directionX * FILTER_DISTANCE_METERS + firstOffsetX * distancePerSample / FILTER_DISTANCE_METERS) * decayFactor;
    path.secondZ = nextZ - 2 * directionZ * FILTER_DISTANCE_METERS + (path.secondZ - inputZ + 2 * directionZ * FILTER_DISTANCE_METERS + firstOffsetZ * distancePerSample / FILTER_DISTANCE_METERS) * decayFactor;
    path.firstX = nextX - directionX * FILTER_DISTANCE_METERS + firstOffsetX * decayFactor;
    path.firstZ = nextZ - directionZ * FILTER_DISTANCE_METERS + firstOffsetZ * decayFactor;
    const tangentX = path.firstX - path.secondX;
    const tangentZ = path.firstZ - path.secondZ;
    const tangentLength = Math.hypot(tangentX, tangentZ);
    if (tangentLength > .00001) samples.push({ worldX: path.secondX, worldZ: path.secondZ, directionX: tangentX / tangentLength, directionZ: tangentZ / tangentLength });
    inputX = nextX; inputZ = nextZ;
  }
  path.previousX = worldX; path.previousZ = worldZ;
  return samples;
}
