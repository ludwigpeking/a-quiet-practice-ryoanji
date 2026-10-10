import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothRakeHeading } from '../src/rake-heading.js';

test('one-pixel direction noise is damped, but a deliberate turn catches up', function smoothNoise() {
  const quarterTurn = Math.PI / 2;
  assert.ok(smoothRakeHeading(0, quarterTurn, 1) < quarterTurn * .055);
  assert.ok(smoothRakeHeading(0, quarterTurn, 4) < quarterTurn * .20);
  assert.ok(smoothRakeHeading(0, quarterTurn, 60) > quarterTurn * .94);
});
test('heading filter depends on travel distance instead of pointer event frequency', function distanceBasedFilter() {
  let angle = 0;
  for (let pixelIndex = 0; pixelIndex < 14; pixelIndex++) angle = smoothRakeHeading(angle, 1, 1);
  assert.ok(Math.abs(angle - smoothRakeHeading(0, 1, 14)) < 1e-12);
  assert.equal(smoothRakeHeading(.4, 1, 0), .4);
});
test('rake reversals preserve the bar orientation', function reverseStroke() {
  assert.ok(Math.abs(smoothRakeHeading(0, Math.PI, 8)) < 1e-12);
});
