export function createCicadaSamples(sampleRate, randomNumber = Math.random) {
  const durationSeconds = 8;
  const samples = new Float32Array(sampleRate * durationSeconds);
  let previousNoise = 0;
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    const elapsedSeconds = sampleIndex / sampleRate;
    const noise = randomNumber() * 2 - 1;
    const brightNoise = (noise - previousNoise) * .5;
    previousNoise = noise;
    const pulse = .55 + .45 * Math.sin(Math.PI * 2 * (43 * elapsedSeconds + .7 * Math.sin(elapsedSeconds * 2)));
    const swell = Math.sin(Math.PI * elapsedSeconds / durationSeconds) ** 1.5;
    const chorus = .72 + .28 * Math.sin(elapsedSeconds * 2.4);
    samples[sampleIndex] = (brightNoise * .72 + Math.sin(Math.PI * 2 * 4350 * elapsedSeconds) * .08) * pulse * swell * chorus;
  }
  return samples;
}

export function createGardenAmbience() {
  let audioContext = null;
  let masterGain;
  let windGain;
  let enabled = false;
  let hidden = false;
  let season = 'summer';
  let nextCicadaSeconds = 0;
  let cicadaBuffer = null;
  const activeVoices = new Set();

  function makeBuffer(samples) {
    const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
    buffer.copyToChannel(samples, 0);
    return buffer;
  }

  function initialize() {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain(); masterGain.gain.value = 0;
    masterGain.connect(audioContext.destination);
    windGain = audioContext.createGain(); windGain.gain.value = .025;
    windGain.connect(masterGain);
    const samples = new Float32Array(audioContext.sampleRate * 8);
    let previousSample = 0;
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
      previousSample = (previousSample + (Math.random() * 2 - 1) * .018) / 1.018;
      const edgeFade = Math.min(1, sampleIndex / 2400, (samples.length - 1 - sampleIndex) / 2400);
      samples[sampleIndex] = previousSample * 3 * edgeFade;
    }
    const windSource = audioContext.createBufferSource(); windSource.buffer = makeBuffer(samples); windSource.loop = true;
    const windFilter = audioContext.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 900;
    windSource.connect(windFilter); windFilter.connect(windGain); windSource.start();
  }

  function stopWildlife() {
    if (!audioContext) return;
    for (const voice of activeVoices) {
      voice.gain.gain.cancelScheduledValues(audioContext.currentTime);
      voice.gain.gain.setTargetAtTime(0, audioContext.currentTime, .025);
      voice.source.stop(audioContext.currentTime + .15);
    }
    activeVoices.clear();
  }

  function playVoice(buffer, kind, volume, pan) {
    const source = audioContext.createBufferSource(); source.buffer = buffer;
    const gain = audioContext.createGain(); gain.gain.value = volume;
    const panner = audioContext.createStereoPanner(); panner.pan.value = pan;
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 4700;
    filter.Q.value = .85;
    source.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(masterGain);
    const voice = { source, gain, kind };
    activeVoices.add(voice);
    source.onended = function releaseVoice() { source.disconnect(); filter.disconnect(); gain.disconnect(); panner.disconnect(); activeVoices.delete(voice); };
    source.start();
  }

  function setSeason(nextSeason) {
    season = ['spring', 'summer', 'autumn', 'winter'].includes(nextSeason) ? nextSeason : 'summer';
    stopWildlife();
    nextCicadaSeconds = (audioContext ? audioContext.currentTime : 0) + 4;
  }

  async function setEnabled(nextEnabled) {
    if (nextEnabled && !audioContext) initialize();
    if (!audioContext) return false;
    if (nextEnabled && !hidden) await audioContext.resume();
    enabled = nextEnabled;
    masterGain.gain.setTargetAtTime(enabled ? .7 : 0, audioContext.currentTime, .15);
    if (enabled) setSeason(season);
    else {
      stopWildlife();
      setTimeout(function suspendMutedAudio() { if (!enabled) audioContext.suspend(); }, 700);
    }
    return enabled;
  }

  function setHidden(nextHidden) {
    hidden = nextHidden;
    if (!audioContext) return;
    if (hidden) { stopWildlife(); audioContext.suspend(); }
    else if (enabled) { audioContext.resume().catch(function ignoreBlockedResume() {}); setSeason(season); }
  }

  function update(breezeStrength) {
    if (!enabled || hidden || !audioContext || audioContext.state !== 'running') return;
    const nowSeconds = audioContext.currentTime;
    windGain.gain.setTargetAtTime(.025 + breezeStrength * .16, nowSeconds, .4);
    if (season === 'summer' && nowSeconds >= nextCicadaSeconds) {
      if (!cicadaBuffer) cicadaBuffer = makeBuffer(createCicadaSamples(audioContext.sampleRate));
      playVoice(cicadaBuffer, 'cicada', .13, (Math.random() - .5) * .9);
      nextCicadaSeconds = nowSeconds + 18 + Math.random() * 14;
    }
  }

  function inspect() {
    return { enabled, hidden, season, contextState: audioContext ? audioContext.state : 'uninitialized', activeVoices: Array.from(activeVoices, function voiceKind(voice) { return voice.kind; }) };
  }
  return { setEnabled, setSeason, setHidden, update, inspect };
}
