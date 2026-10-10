import test from 'node:test';
import assert from 'node:assert/strict';
import { breezeStrengthAtTime, createForestBreeze } from '../src/breeze.js';
import { createCicadaSamples } from '../src/ambience.js';

test('gusts ease in and out with short calm intervals', function verifyGusts() {
  let activeSamples = 0;
  let previousStrength = 0;
  let calmSamples = 0;
  let hasStarted = false;
  for (let sampleIndex = 0; sampleIndex < 11700; sampleIndex++) {
    const strength = breezeStrengthAtTime(sampleIndex / 100);
    assert.ok(strength >= 0 && strength <= 1);
    assert.ok(Math.abs(strength - previousStrength) < .006);
    if (strength > 0) {
      activeSamples++;
      if (hasStarted && calmSamples > 0) assert.ok(calmSamples >= 590 && calmSamples <= 1110);
      hasStarted = true;
      calmSamples = 0;
    } else if (hasStarted) calmSamples++;
    previousStrength = strength;
  }
  assert.ok(activeSamples > 7000 && activeSamples < 8500);
});

test('breeze limits ambient redraws and restores rest for reduced motion', function verifyMotion() {
  const breeze = createForestBreeze();
  let requestedFrames = 0;
  for (let frameIndex = 0; frameIndex < 600; frameIndex++) {
    if (breeze.update(1 / 60, false)) requestedFrames++;
  }
  assert.ok(requestedFrames > 80 && requestedFrames < 220);
  assert.ok(breeze.inspect().strength > 0);
  assert.equal(breeze.update(1 / 60, true), true);
  assert.equal(breeze.inspect().strength, 0);
  assert.equal(breeze.update(1 / 60, true), false);
});

test('cicada swells have bounded finite samples and quiet edges', function verifyAudio() {
  const cicadas = createCicadaSamples(24000);
  let cicadaEnergy = 0;
  for (const sample of cicadas) { assert.ok(Number.isFinite(sample) && Math.abs(sample) < 1); cicadaEnergy += sample * sample; }
  assert.ok(cicadaEnergy > 100);
  assert.equal(Math.abs(cicadas[0]), 0); assert.ok(Math.abs(cicadas[cicadas.length - 1]) < .00001);
});
