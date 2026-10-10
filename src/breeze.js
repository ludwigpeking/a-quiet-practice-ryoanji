import * as THREE from 'three';

// Smooth gusts separated by long still intervals; time is visible garden time.
export function breezeStrengthAtTime(elapsedSeconds) {
  const cycleDuration = 39;
  const cycleIndex = Math.floor(elapsedSeconds / cycleDuration);
  const cycleSeconds = elapsedSeconds % cycleDuration;
  const gustStart = 3 + Math.sin(cycleIndex * 2.3) * 1.2;
  const gustDuration = 16.5 + Math.sin(cycleIndex * 1.7) * 2.5;
  const gustFraction = (cycleSeconds - gustStart) / gustDuration;
  if (gustFraction <= 0 || gustFraction >= 1) return 0;
  return Math.sin(gustFraction * Math.PI) ** 2 * (.72 + .18 * Math.sin(cycleIndex * 1.4 + .7));
}

export function createForestBreeze() {
  const timeUniform = { value: 0 };
  const strengthUniform = { value: 0 };
  let elapsedSeconds = 0;
  let lastPaintSeconds = -1;
  let lastPaintStrength = 0;

  function applyToMaterial(material, flutterAmount = 0) {
    material.onBeforeCompile = function addBreeze(shader) {
      shader.uniforms.gardenWindTime = timeUniform;
      shader.uniforms.gardenWindStrength = strengthUniform;
      shader.vertexShader = `uniform float gardenWindTime;
uniform float gardenWindStrength;
` + shader.vertexShader;
      // Forest meshes have identity model transforms. Apply after instancing so
      // branches, crown masses and leaf cards share a continuous spatial field.
      shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', THREE.ShaderChunk.project_vertex.replace(
        'mvPosition = modelViewMatrix * mvPosition;',
        `float windHeight = max(0.0, mvPosition.y);
float windPhase = gardenWindTime * 1.15 + mvPosition.x * .14 + mvPosition.z * .11;
float windBend = gardenWindStrength * pow(min(windHeight / 15.0, 1.3), 1.35);
mvPosition.x += windBend * (.08 + .07 * sin(windPhase));
mvPosition.z += windBend * .035 * sin(windPhase * .83 + .8);
mvPosition.x += gardenWindStrength * min(windHeight, 1.0) * ${flutterAmount.toFixed(4)} * sin(gardenWindTime * 3.1 + mvPosition.x * 1.6 + mvPosition.z * 1.3);
mvPosition = modelViewMatrix * mvPosition;`
      ));
    };
    material.customProgramCacheKey = function breezeProgramKey() { return `garden-breeze-v1-${flutterAmount}`; };
  }

  function update(frameDuration, reducedMotion) {
    elapsedSeconds += Math.min(frameDuration, .1);
    const nextStrength = reducedMotion ? 0 : breezeStrengthAtTime(elapsedSeconds);
    const needsRestFrame = nextStrength === 0 && lastPaintStrength !== 0;
    if (!needsRestFrame && (nextStrength === 0 || elapsedSeconds - lastPaintSeconds < 1 / 30)) return false;
    timeUniform.value = elapsedSeconds;
    strengthUniform.value = nextStrength;
    lastPaintSeconds = elapsedSeconds;
    lastPaintStrength = nextStrength;
    return true;
  }

  function inspect() { return { strength: strengthUniform.value, elapsedSeconds }; }
  return { applyToMaterial, update, inspect };
}
