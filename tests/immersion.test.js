import test from 'node:test';
import assert from 'node:assert/strict';
import { startGardenImmersion } from '../src/immersion.js';

test('audio and fullscreen begin synchronously in the activating click', async function checkActivation() {
  const startedRequests = [];
  let finishAudio;
  const completion = startGardenImmersion(
    function enableSound() { startedRequests.push('sound'); return new Promise(function pendingAudio(resolve) { finishAudio = resolve; }); },
    function enterFullscreen() { startedRequests.push('fullscreen'); }
  );
  assert.deepEqual(startedRequests, ['sound', 'fullscreen']);
  finishAudio(true);
  assert.deepEqual((await completion).map(function getStatus(result) { return result.status; }), ['fulfilled', 'fulfilled']);
});

test('a denied fullscreen request does not cancel sound or reject the entrance', async function checkDeniedFullscreen() {
  const results = await startGardenImmersion(
    function enableSound() { return true; },
    function enterFullscreen() { return Promise.reject(new Error('Fullscreen denied')); }
  );
  assert.equal(results[0].value, true);
  assert.equal(results[1].status, 'rejected');
});

test('unavailable audio still allows the fullscreen request', async function checkUnavailableAudio() {
  let fullscreenRequested = false;
  const results = await startGardenImmersion(
    function enableSound() { throw new Error('Audio unavailable'); },
    function enterFullscreen() { fullscreenRequested = true; }
  );
  assert.equal(fullscreenRequested, true);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
});
