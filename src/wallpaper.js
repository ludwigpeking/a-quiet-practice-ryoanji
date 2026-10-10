export const wallpaperSeasons = ['spring', 'summer', 'autumn', 'winter'];

export function readWallpaperOptions(search, packaged = false) {
  const parameters = new URLSearchParams(search);
  const requestedSeason = parameters.get('season');
  const requestedFrameRate = Number(parameters.get('fps'));
  return {
    enabled: packaged || parameters.get('wallpaper') === '1',
    season: wallpaperSeasons.includes(requestedSeason) ? requestedSeason : null,
    framesPerSecond: [15, 24, 30, 60].includes(requestedFrameRate) ? requestedFrameRate : 30,
  };
}

// Keep animation time continuous across skipped display refreshes. Discard
// paused time so returning to the desktop never produces a sudden gust.
export function createWallpaperFrameGate(framesPerSecond) {
  let accumulatedSeconds = 0;
  return {
    setFrameRate: function setFrameRate(value) {
      if ([15, 24, 30, 60].includes(value)) framesPerSecond = value;
      accumulatedSeconds = 0;
    },
    advance: function advance(elapsedSeconds, paused) {
      if (paused) { accumulatedSeconds = 0; return 0; }
      accumulatedSeconds += Math.min(elapsedSeconds, .1);
      const intervalSeconds = 1 / framesPerSecond;
      if (accumulatedSeconds + 1e-8 < intervalSeconds) return 0;
      const animationSeconds = Math.floor((accumulatedSeconds + 1e-8) / intervalSeconds) * intervalSeconds;
      accumulatedSeconds = Math.max(0, accumulatedSeconds - animationSeconds);
      return animationSeconds;
    },
  };
}

export function installWallpaperCallbacks(target, handlers) {
  target.livelyPropertyListener = function livelyPropertyListener(name, value) {
    const selectedIndex = Number(value);
    if (!Number.isInteger(selectedIndex)) return;
    if (name === 'season' && wallpaperSeasons[selectedIndex]) handlers.setSeason(wallpaperSeasons[selectedIndex]);
    if (name === 'frameRate' && [15, 24, 30, 60][selectedIndex]) handlers.setFrameRate([15, 24, 30, 60][selectedIndex]);
  };
  target.livelyWallpaperPlaybackChanged = function livelyWallpaperPlaybackChanged(data) {
    try {
      const playbackState = typeof data === 'string' ? JSON.parse(data) : data;
      if (typeof playbackState?.IsPaused === 'boolean') handlers.setPaused(playbackState.IsPaused);
    } catch { /* Ignore malformed host messages without interrupting the scene. */ }
  };
}
