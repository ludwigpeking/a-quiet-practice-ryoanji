import test from 'node:test';
import assert from 'node:assert/strict';
import { readWallpaperOptions, createWallpaperFrameGate, installWallpaperCallbacks } from '../src/wallpaper.js';

test('wallpaper is opt-in and query settings have safe defaults', function () {
  assert.equal(readWallpaperOptions('').enabled, false);
  assert.deepEqual(readWallpaperOptions('?wallpaper=1&season=spring&fps=24'), { enabled: true, season: 'spring', framesPerSecond: 24 });
  assert.deepEqual(readWallpaperOptions('?season=unknown&fps=Infinity', true), { enabled: true, season: null, framesPerSecond: 30 });
});

test('30 fps cap preserves animation time across different display rates', function () {
  for (const refreshRate of [60, 120, 144]) {
    const gate = createWallpaperFrameGate(30);
    let renderedFrames = 0;
    let animationSeconds = 0;
    for (let frameIndex = 0; frameIndex < refreshRate * 10; frameIndex++) {
      const elapsedSeconds = gate.advance(1 / refreshRate, false);
      if (elapsedSeconds) renderedFrames++;
      animationSeconds += elapsedSeconds;
    }
    assert.ok(renderedFrames >= 299 && renderedFrames <= 300, `${refreshRate} Hz: ${renderedFrames} frames`);
    assert.ok(Math.abs(animationSeconds - 10) < .035);
  }
});

test('Lively pause and customization events reach the animation controller', function () {
  const target = {};
  const state = {};
  installWallpaperCallbacks(target, {
    setSeason: function (value) { state.season = value; },
    setFrameRate: function (value) { state.frameRate = value; },
    setPaused: function (value) { state.paused = value; },
  });
  target.livelyPropertyListener('season', 0);
  target.livelyPropertyListener('frameRate', 1);
  target.livelyWallpaperPlaybackChanged('{"IsPaused":true}');
  assert.deepEqual(state, { season: 'spring', frameRate: 24, paused: true });
  target.livelyPropertyListener('season', 500);
  target.livelyWallpaperPlaybackChanged('bad data');
  assert.equal(state.season, 'spring');
  const gate = createWallpaperFrameGate(30);
  assert.equal(gate.advance(12, true), 0);
  assert.equal(gate.advance(1 / 60, false), 0);
  assert.ok(gate.advance(1 / 60, false) <= 1 / 30 + 1e-8);
});
