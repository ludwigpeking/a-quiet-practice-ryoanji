import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBrush, createInitialHeights, sampleHeight, COLUMN_COUNT, ROW_COUNT } from '../src/terrain.js';

test('rake contact is a narrow bar that rotates perpendicular to travel', function rakeFootprint() {
  for (const direction of [[1, 0], [0, 1]]) {
    const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
    const [directionX, directionZ] = direction;
    applyBrush(heights, makeStamp({ tool: 'rake', directionX, directionZ }));
    assert.ok(sampleHeight(heights, 0, 0) < -.02);
    assert.equal(sampleHeight(heights, directionX * .5, directionZ * .5), 0, 'the old circular footprint must remain untouched');
    assert.ok(Math.abs(sampleHeight(heights, -directionZ * .66, directionX * .66)) > .005, 'teeth extend across the bar');
  }
});

test('overlapping rake strokes leave continuous grooves without lowering the whole surface', function rakeContinuity() {
  const referenceHeights = new Float32Array(COLUMN_COUNT * ROW_COUNT).fill(.3);
  const heights = referenceHeights.slice();
  for (let stampIndex = 0; stampIndex <= 100; stampIndex++) {
    applyBrush(heights, makeStamp({ tool: 'rake', worldX: -2 + stampIndex * .04, elapsedSeconds: .04, referenceHeights }));
  }
  for (const worldX of [-1.5, -1, 0, 1, 1.5]) assert.ok(sampleHeight(heights, worldX, 0) < .27);
  assert.ok(Math.min(...heights) >= .2579);
  assert.ok(Math.max(...heights) <= .3421);
  assert.ok(Math.abs(sampleHeight(heights, 0, 2) - .3) < .00001);
});

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
