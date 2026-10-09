import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBrush, createInitialHeights, sampleHeight, COLUMN_COUNT, ROW_COUNT } from '../src/terrain.js';

function makeStamp(overrides = {}) { return { worldX: 0, worldZ: 0, radius: 1, pressure: .8, tool: 'raise', directionX: 1, directionZ: 0, elapsedSeconds: .1, ...overrides }; }
function sumHeights(heights) { return heights.reduce(function addHeight(totalHeight, height) { return totalHeight + height; }, 0); }

test('raising and pressing change the center and leave distant sand untouched', function sculptBounds() {
  const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
  applyBrush(heights, makeStamp());
  assert.ok(sampleHeight(heights, 0, 0) > .08);
  assert.equal(sampleHeight(heights, 5, 3), 0);
  applyBrush(heights, makeStamp({ tool: 'press', elapsedSeconds: .3 }));
  assert.ok(sampleHeight(heights, 0, 0) < -.1);
});
test('push conserves sand volume at the center and boundary', function conserveSand() {
  for (const worldX of [0, 11.8, -11.8]) {
    const heights = createInitialHeights([]);
    const previousVolume = sumHeights(heights);
    applyBrush(heights, makeStamp({ tool: 'push', worldX }));
    assert.ok(Math.abs(sumHeights(heights) - previousVolume) < .00001);
    assert.ok(heights.every(Number.isFinite));
  }
});
test('smoothing reduces a spike and never affects outside the brush', function smoothSpike() {
  const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
  const centerIndex = Math.floor(ROW_COUNT / 2) * COLUMN_COUNT + Math.floor(COLUMN_COUNT / 2);
  heights[centerIndex] = 1;
  applyBrush(heights, makeStamp({ tool: 'smooth' }));
  assert.ok(heights[centerIndex] < 1);
  assert.equal(sampleHeight(heights, 4, 2), 0);
});
test('long sculpting remains within stable height limits', function heightLimits() {
  const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
  for (let strokeIndex = 0; strokeIndex < 100; strokeIndex++) applyBrush(heights, makeStamp({ elapsedSeconds: 1 }));
  assert.ok(Math.max(...heights) <= 1.5);
  for (let strokeIndex = 0; strokeIndex < 100; strokeIndex++) applyBrush(heights, makeStamp({ tool: 'press', elapsedSeconds: 1 }));
  assert.ok(Math.min(...heights) >= -.650001);
});
