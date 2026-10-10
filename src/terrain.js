export const GARDEN_WIDTH = 24;
export const GARDEN_DEPTH = 11.5;
export const COLUMN_COUNT = 289;
export const ROW_COUNT = 139;
export const CELL_WIDTH = GARDEN_WIDTH / (COLUMN_COUNT - 1);
export const CELL_DEPTH = GARDEN_DEPTH / (ROW_COUNT - 1);

export function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

export function createInitialHeights(stoneDefinitions) {
  const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
  for (let rowIndex = 0; rowIndex < ROW_COUNT; rowIndex++) {
    const worldZ = rowIndex * CELL_DEPTH - GARDEN_DEPTH / 2;
    for (let columnIndex = 0; columnIndex < COLUMN_COUNT; columnIndex++) {
      const worldX = columnIndex * CELL_WIDTH - GARDEN_WIDTH / 2;
      let grooveHeight = Math.sin(worldZ * 28) * .026;
      let nearestDistance = Infinity;
      let nearestStoneSize = 1;
      for (const stone of stoneDefinitions) {
        const distance = Math.hypot((worldX - stone.positionX) * .85, worldZ - stone.positionZ);
        if (distance < nearestDistance) { nearestDistance = distance; nearestStoneSize = stone.size ?? 1; }
      }
      const ringRadius = 1.1 + nearestStoneSize * .6;
      if (nearestDistance < ringRadius) {
        const blendFactor = clamp((ringRadius - nearestDistance) / .45, 0, 1);
        const smoothBlend = blendFactor * blendFactor * (3 - 2 * blendFactor);
        grooveHeight = grooveHeight * (1 - smoothBlend) + Math.sin(nearestDistance * 28) * .026 * smoothBlend;
      }
      heights[rowIndex * COLUMN_COUNT + columnIndex] = grooveHeight;
    }
  }
  return heights;
}

export function sampleHeight(heights, worldX, worldZ) {
  const columnCoordinate = clamp((worldX + GARDEN_WIDTH / 2) / CELL_WIDTH, 0, COLUMN_COUNT - 1);
  const rowCoordinate = clamp((worldZ + GARDEN_DEPTH / 2) / CELL_DEPTH, 0, ROW_COUNT - 1);
  const leftColumn = Math.floor(columnCoordinate);
  const upperRow = Math.floor(rowCoordinate);
  const rightColumn = Math.min(leftColumn + 1, COLUMN_COUNT - 1);
  const lowerRow = Math.min(upperRow + 1, ROW_COUNT - 1);
  const horizontalFraction = columnCoordinate - leftColumn;
  const verticalFraction = rowCoordinate - upperRow;
  const upperHeight = heights[upperRow * COLUMN_COUNT + leftColumn] * (1 - horizontalFraction) + heights[upperRow * COLUMN_COUNT + rightColumn] * horizontalFraction;
  const lowerHeight = heights[lowerRow * COLUMN_COUNT + leftColumn] * (1 - horizontalFraction) + heights[lowerRow * COLUMN_COUNT + rightColumn] * horizontalFraction;
  return upperHeight * (1 - verticalFraction) + lowerHeight * verticalFraction;
}

// Every stamp is bounded to the courtyard. Push redistributes an equal volume
// between the trailing and leading halves, including at the garden boundary.
export function applyBrush(heights, options) {
  const { worldX, worldZ, radius, pressure, tool, directionX, directionZ, elapsedSeconds } = options;
  const minimumColumn = clamp(Math.floor((worldX - radius + GARDEN_WIDTH / 2) / CELL_WIDTH), 0, COLUMN_COUNT - 1);
  const maximumColumn = clamp(Math.ceil((worldX + radius + GARDEN_WIDTH / 2) / CELL_WIDTH), 0, COLUMN_COUNT - 1);
  const minimumRow = clamp(Math.floor((worldZ - radius + GARDEN_DEPTH / 2) / CELL_DEPTH), 0, ROW_COUNT - 1);
  const maximumRow = clamp(Math.ceil((worldZ + radius + GARDEN_DEPTH / 2) / CELL_DEPTH), 0, ROW_COUNT - 1);
  const previousHeights = tool === 'smooth' ? heights.slice() : heights;
  const pushCells = [];
  let positiveWeight = 0;
  let negativeWeight = 0;
  for (let rowIndex = minimumRow; rowIndex <= maximumRow; rowIndex++) {
    for (let columnIndex = minimumColumn; columnIndex <= maximumColumn; columnIndex++) {
      const offsetX = columnIndex * CELL_WIDTH - GARDEN_WIDTH / 2 - worldX;
      const offsetZ = rowIndex * CELL_DEPTH - GARDEN_DEPTH / 2 - worldZ;
      const distance = Math.hypot(offsetX, offsetZ);
      if (distance >= radius) continue;
      const vertexIndex = rowIndex * COLUMN_COUNT + columnIndex;
      const falloff = Math.pow(1 - distance * distance / (radius * radius), 2);
      const changeAmount = pressure * elapsedSeconds * falloff;
      if (tool === 'raise' || tool === 'press') heights[vertexIndex] = clamp(heights[vertexIndex] + changeAmount * (tool === 'raise' ? 1.2 : -1.2), -.65, 1.5);
      if (tool === 'rake') {
        const lateralDistance = offsetX * -directionZ + offsetZ * directionX;
        const targetHeight = Math.sin(lateralDistance * 28) * .042;
        const lowFrequencyHeight = sampleHeight(heights, worldX, worldZ) * .85;
        heights[vertexIndex] += (targetHeight + lowFrequencyHeight - heights[vertexIndex]) * clamp(changeAmount * 24, 0, .8);
      }
      if (tool === 'smooth') {
        let heightSum = 0;
        let sampleCount = 0;
        for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
          for (let columnOffset = -2; columnOffset <= 2; columnOffset++) {
            const neighborRow = clamp(rowIndex + rowOffset, 0, ROW_COUNT - 1);
            const neighborColumn = clamp(columnIndex + columnOffset, 0, COLUMN_COUNT - 1);
            heightSum += previousHeights[neighborRow * COLUMN_COUNT + neighborColumn];
            sampleCount++;
          }
        }
        heights[vertexIndex] += (heightSum / sampleCount - previousHeights[vertexIndex]) * clamp(changeAmount * 15, 0, 1);
      }
      if (tool === 'push') {
        const forwardDistance = (offsetX * directionX + offsetZ * directionZ) / radius;
        const weight = forwardDistance * falloff;
        pushCells.push({ vertexIndex, weight });
        if (weight > 0) positiveWeight += weight;
        else negativeWeight -= weight;
      }
    }
  }
  if (tool === 'push' && positiveWeight > 0 && negativeWeight > 0) {
    const transportedAmount = pressure * elapsedSeconds * Math.min(positiveWeight, negativeWeight) * 3;
    let maximumFraction = 1;
    for (const cell of pushCells) {
      cell.change = transportedAmount * cell.weight / (cell.weight > 0 ? positiveWeight : negativeWeight);
      const remainingHeight = cell.change > 0 ? 1.5 - heights[cell.vertexIndex] : heights[cell.vertexIndex] + .65;
      if (cell.change !== 0) maximumFraction = Math.min(maximumFraction, remainingHeight / Math.abs(cell.change));
    }
    for (const cell of pushCells) heights[cell.vertexIndex] += cell.change * Math.max(0, maximumFraction);
  }
}
