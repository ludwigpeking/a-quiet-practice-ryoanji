// Both browser requests must start within the same click, before awaiting either.
export function startGardenImmersion(enableSound, enterFullscreen) {
  function startRequest(request) {
    try { return Promise.resolve(request()); }
    catch (error) { return Promise.reject(error); }
  }
  const soundRequest = startRequest(enableSound);
  const fullscreenRequest = startRequest(enterFullscreen);
  return Promise.allSettled([soundRequest, fullscreenRequest]);
}
