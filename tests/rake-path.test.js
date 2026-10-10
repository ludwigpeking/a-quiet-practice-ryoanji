import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRakePath, advanceRakePath, planRakeContact } from '../src/rake-path.js';

test('integer-pixel diagonal stairs reconstruct a subpixel line and stable tangent', function quantizedDiagonals() {
  for (const slope of [.18, .53, 1.7, -.37]) {
    const path = createRakePath(0, 0);
    const expectedAngle = Math.atan(slope);
    let largestPositionError = 0, largestAngleError = 0;
    for (let inputStep = 1; inputStep <= 240; inputStep++) {
      const samples = advanceRakePath(path, inputStep * .025, Math.round(inputStep * slope) * .025);
      if (inputStep < 50) continue;
      for (const sample of samples) {
        largestPositionError = Math.max(largestPositionError, Math.abs(sample.worldZ - sample.worldX * slope) / Math.hypot(1, slope));
        largestAngleError = Math.max(largestAngleError, Math.abs(Math.atan2(sample.directionZ, sample.directionX) - expectedAngle));
      }
    }
    assert.ok(largestPositionError < .004, `slope ${slope}: centerline error ${largestPositionError} meters`);
    assert.ok(largestAngleError < .035, `slope ${slope}: tangent error ${largestAngleError} radians`);
  }
});

test('coarse and finely subdivided straight pointer reports produce the same path', function eventRateIndependence() {
  const coarsePath = createRakePath(0, 0);
  const coarseSamples = advanceRakePath(coarsePath, 5, 2.5);
  const finePath = createRakePath(0, 0);
  let fineSamples;
  for (let inputStep = 1; inputStep <= 200; inputStep++) fineSamples = advanceRakePath(finePath, inputStep * .025, inputStep * .0125);
  const coarseEnd = coarseSamples.at(-1), fineEnd = fineSamples.at(-1);
  for (const field of ['worldX', 'worldZ', 'directionX', 'directionZ']) assert.ok(Math.abs(coarseEnd[field] - fineEnd[field]) < 1e-9);
});

test('intentional curved movement stays curved and responds within a short trailing distance', function followCurve() {
  const radius = 3;
  const path = createRakePath(radius, 0);
  let lastSample;
  for (let angle = .01; angle <= Math.PI / 2; angle += .01) {
    const worldX = Math.round(Math.cos(angle) * radius * 40) / 40, worldZ = Math.round(Math.sin(angle) * radius * 40) / 40;
    const samples = advanceRakePath(path, worldX, worldZ);
    if (!samples.length) continue;
    lastSample = samples.at(-1);
    assert.ok(Math.hypot(lastSample.worldX - worldX, lastSample.worldZ - worldZ) < .61);
    assert.ok(Math.abs(Math.hypot(lastSample.worldX, lastSample.worldZ) - radius) < .05);
  }
  assert.ok(lastSample.directionX < -.98);
});

test('stationary pointer and initial pixel noise do not generate rake strokes', function noStationaryStroke() {
  const path = createRakePath(1, 1);
  for (let sampleIndex = 0; sampleIndex < 50; sampleIndex++) assert.deepEqual(advanceRakePath(path, 1 + sampleIndex % 2 * .025, 1 - sampleIndex % 2 * .025), []);
  advanceRakePath(path, 2, 1);
  assert.deepEqual(advanceRakePath(path, 2, 1), []);
});

test('a reversal preserves the rake axis without a sideways loop', function reverseDirection() {
  const path = createRakePath(0, 0);
  advanceRakePath(path, 3, 0);
  const samples = advanceRakePath(path, 0, 0);
  for (const sample of samples) {
    assert.ok(Number.isFinite(sample.directionX));
    assert.equal(sample.worldZ, 0);
    assert.equal(sample.directionZ, 0);
  }
  assert.ok(samples.at(-1).directionX < -.99);
});

test('quantized screen input maps to the same courtyard direction from different cameras', function perspectiveIndependentDirection() {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  for (const cameraPosition of [[.6, 2.7, 11.25], [6, 8, 12], [-5, 12, 9]]) {
    const camera = new THREE.PerspectiveCamera(64, 1.5, .1, 150);
    camera.position.fromArray(cameraPosition); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    let path;
    for (let inputStep = 0; inputStep <= 300; inputStep++) {
      const worldX = -3 + inputStep * .02;
      const projected = new THREE.Vector3(worldX, 0, worldX * .35).project(camera);
      const screenX = Math.round((projected.x + 1) * 480), screenY = Math.round((1 - projected.y) * 320);
      raycaster.setFromCamera(new THREE.Vector2(screenX / 480 - 1, 1 - screenY / 320), camera);
      const ground = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!path) path = createRakePath(ground.x, ground.z);
      for (const sample of advanceRakePath(path, ground.x, ground.z)) {
        if (inputStep < 100) continue;
        assert.ok(Math.abs(sample.worldZ - sample.worldX * .35) < .03);
        assert.ok(Math.abs(Math.atan2(sample.directionZ, sample.directionX) - Math.atan(.35)) < .08);
      }
    }
  }
});

test('the rake lifts on backward travel and resumes as a new forward pull', function directionalRake() {
  assert.equal(planRakeContact(0, 0, .1, 0, true).shouldLift, false);
  assert.equal(planRakeContact(0, 0, -.1, 0, true).shouldLift, true);
  const reversal = planRakeContact(0, Math.PI, -.1, 0, true);
  assert.equal(reversal.shouldLift, true);
  assert.equal(reversal.turnAngle, 0);
  const nextPull = planRakeContact(Math.PI, Math.PI, -.1, 0, false);
  assert.equal(nextPull.shouldLift, false);
  assert.equal(nextPull.startAngle, Math.PI);
});

test('a deliberate forward curve turns the leading edge continuously', function forwardCurve() {
  const contact = planRakeContact(.5, .7, Math.cos(.6), Math.sin(.6), true);
  assert.equal(contact.shouldLift, false);
  assert.ok(Math.abs(contact.turnAngle - .2) < 1e-10);
});
