import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createGardenScene, createStone, seatStoneOnTerrain, originalStones } from './scene.js';
import { createInitialHeights, applyBrush, sampleHeight, resampleSavedHeights, clamp, COLUMN_COUNT, ROW_COUNT, RAKE_TOOTH_SPACING, RAKE_HALF_DEPTH } from './terrain.js';
import { createRakePath, advanceRakePath, planRakeContact } from './rake-path.js';
import { createGardenAmbience } from './ambience.js';
import './style.css';
import './minimal.css';

const canvas = document.querySelector('#garden');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
} catch (error) {
  document.querySelector('#loading').innerHTML = '<span class="loading-mark">庭</span><h2>The garden needs WebGL.</h2><p>Please enable hardware acceleration in your browser, then reload.</p>';
  throw error;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const { scene, sand, sunlight, hemisphere, fillLight, rockMaterial, mossMaterial, temple, forest } = createGardenScene();
const gardenAmbience = createGardenAmbience();
const reducedMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let renderRequested = true;
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, .1, 150);
camera.position.set(0, 2.7, 11.25);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, .38, -.6);
controls.enableDamping = true; controls.dampingFactor = .065;
controls.minDistance = 9.5; controls.maxDistance = 12.3;
controls.minPolarAngle = 1.34; controls.maxPolarAngle = 1.44;
controls.minAzimuthAngle = -.36; controls.maxAzimuthAngle = .36;
controls.enablePan = false;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.update();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const ambientOcclusion = new SSAOPass(scene, camera, innerWidth, innerHeight);
ambientOcclusion.kernelRadius = .55;
ambientOcclusion.minDistance = .002;
ambientOcclusion.maxDistance = .16;
composer.addPass(ambientOcclusion);
composer.addPass(new OutputPass());
ambientOcclusion.setSize(Math.ceil(innerWidth * .65), Math.ceil(innerHeight * .65));

let heights = createInitialHeights(originalStones);
let terrainRevision = 0;
const stoneGroup = new THREE.Group(); scene.add(stoneGroup);
let activeTool = 'rake';
let brushDiameter = 1.6;
let brushPressure = .45;
let chosenStoneShape = 'spire';
let chosenStoneSize = 1;
let chosenLighting = 'afternoon';
let chosenSeason = 'summer';
let isElevatedView = false;
let isContemplating = false;
let isSculpting = false;
let selectedStone = null;
let draggedStone = null;
let pointerIsInside = false;
let terrainNeedsUpdate = true;
let strokeDirection = new THREE.Vector2(1, 0);
let lastStrokePoint = null;
let rakePath = null;
let rakeCursorPoint = null;
let rakeStrokeHasMoved = false;
let rakeReferenceHeights = null;
let rakeHeadingAngle = 0;
const pointerPosition = new THREE.Vector2(2, 2);
const raycaster = new THREE.Raycaster();
// Sculpting coordinates are independent of the displaced heightfield.
const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const history = [];
const storageKey = 'ryoanji-garden-v1';
const toolDescriptions = {
  rake: ['Rake the gravel', 'Pull the leading edge. Reversing lifts and turns the rake.'],
  raise: ['Lift a landscape', 'Build a gentle rise with a patient hand.'],
  press: ['Make a hollow', 'Press into the gravel. Give the light a place to rest.'],
  push: ['Move like water', 'Drag to carry sand forward, leaving a hollow behind.'],
  smooth: ['Soften the edges', 'Let each ridge settle back into stillness.'],
  stone: ['A stone, an island', 'Find a form. Give it room to be itself.'],
};

const brushGeometry = new THREE.BufferGeometry();
const brushPositions = new Float32Array(129 * 3);
brushGeometry.setAttribute('position', new THREE.BufferAttribute(brushPositions, 3));
const brushRing = new THREE.Line(brushGeometry, new THREE.LineBasicMaterial({ color: '#f8f6da', transparent: true, opacity: .9, depthTest: false }));
brushRing.renderOrder = 5; scene.add(brushRing); brushRing.visible = false;
const rakeGeometry = new THREE.BufferGeometry();
const rakePositions = new Float32Array(256 * 3);
rakeGeometry.setAttribute('position', new THREE.BufferAttribute(rakePositions, 3));
const rakeBar = new THREE.LineSegments(rakeGeometry, brushRing.material);
rakeBar.renderOrder = 5; rakeBar.visible = false; scene.add(rakeBar);
const selectionRing = new THREE.Mesh(new THREE.RingGeometry(.92, .935, 80), new THREE.MeshBasicMaterial({ color: '#e2cb8f', side: THREE.DoubleSide, transparent: true, opacity: .9, depthTest: false }));
selectionRing.rotation.x = -Math.PI / 2; selectionRing.visible = false; selectionRing.renderOrder = 6; scene.add(selectionRing);
let ghostStone = null;

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message; toast.classList.add('visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(function hideToast() { toast.classList.remove('visible'); }, 2300);
}

function updateStoneCount() { document.querySelector('#stone-count').textContent = `${stoneGroup.children.length} STONES`; }

function disposeStone(stone) {
  stone.traverse(function disposeMesh(child) { if (child.isMesh) child.geometry.dispose(); });
  stone.removeFromParent();
  renderer.shadowMap.needsUpdate = true; renderRequested = true;
}

function addStone(definition) {
  const stone = createStone(definition, rockMaterial, mossMaterial);
  seatStoneOnTerrain(stone, heights, terrainRevision);
  stoneGroup.add(stone); updateStoneCount(); return stone;
}

function serializeGarden() {
  return { version: 2, columns: COLUMN_COUNT, rows: ROW_COUNT, heights: Array.from(heights), stones: stoneGroup.children.map(function readStone(stone) { return { ...stone.userData.definition }; }), lighting: chosenLighting, season: chosenSeason };
}

function rememberGarden() {
  history.push({ heights: heights.slice(), stones: stoneGroup.children.map(function readStone(stone) { return { ...stone.userData.definition }; }) });
  if (history.length > 24) history.shift();
  document.querySelector('#undo-button').disabled = false;
  document.querySelector('#save-status').textContent = 'An evolving landscape. Save to keep it.';
}

function restoreGarden(snapshot) {
  heights = resampleSavedHeights(snapshot.heights);
  for (const stone of [...stoneGroup.children]) disposeStone(stone);
  for (const definition of snapshot.stones) addStone(definition);
  selectedStone = null; terrainNeedsUpdate = true; updateStoneCount();
}

function undo() {
  if (!history.length) { showToast('The garden is at its beginning.'); return; }
  restoreGarden(history.pop());
  document.querySelector('#undo-button').disabled = history.length === 0;
  showToast('One gesture, gently undone.');
}

function validateSavedGarden(saved) {
  if (!saved || !Array.isArray(saved.heights)) return false;
  const isLegacyGrid = saved.version === 1 && saved.heights.length === 289 * 139;
  const isCurrentGrid = saved.version === 2 && saved.columns === COLUMN_COUNT && saved.rows === ROW_COUNT && saved.heights.length === COLUMN_COUNT * ROW_COUNT;
  if ((!isLegacyGrid && !isCurrentGrid) || !saved.heights.every(function validHeight(height) { return Number.isFinite(height) && height >= -.66 && height <= 1.51; })) return false;
  return Array.isArray(saved.stones) && saved.stones.length <= 80 && saved.stones.every(function validStone(stone) {
    return ['spire', 'reclining', 'mountain', 'split'].includes(stone.shape) && Number.isFinite(stone.positionX) && Math.abs(stone.positionX) <= 11.8 && Number.isFinite(stone.positionZ) && Math.abs(stone.positionZ) <= 5.5 && Number.isFinite(stone.size) && stone.size >= .3 && stone.size <= 2 && Number.isFinite(stone.rotation) && Number.isFinite(stone.seed);
  });
}

function updateTerrain() {
  terrainRevision++;
  renderRequested = true;
  const positions = sand.geometry.attributes.position;
  const colors = sand.geometry.attributes.color;
  for (let vertexIndex = 0; vertexIndex < heights.length; vertexIndex++) {
    positions.setY(vertexIndex, heights[vertexIndex]);
    const neighborHeight = (heights[Math.max(0, vertexIndex - COLUMN_COUNT)] + heights[Math.min(heights.length - 1, vertexIndex + COLUMN_COUNT)] + heights[Math.max(0, vertexIndex - 1)] + heights[Math.min(heights.length - 1, vertexIndex + 1)]) / 4;
    const shade = clamp(.88 + (heights[vertexIndex] - neighborHeight) * 6.5, .62, 1);
    colors.setXYZ(vertexIndex, shade, shade, shade);
  }
  colors.needsUpdate = true;
  positions.needsUpdate = true;
  sand.geometry.computeVertexNormals(); sand.geometry.computeBoundingSphere();
  for (const stone of stoneGroup.children) {
    const nextHeight = sampleHeight(heights, stone.position.x, stone.position.z);
    if (Math.abs(stone.position.y - nextHeight) > .001) renderer.shadowMap.needsUpdate = true;
    if (seatStoneOnTerrain(stone, heights, terrainRevision)) renderer.shadowMap.needsUpdate = true;
  }
  terrainNeedsUpdate = false;
}

function setLighting(lighting) {
  renderRequested = true; renderer.shadowMap.needsUpdate = true;
  chosenLighting = lighting;
  const configurations = {
    morning: { sun: '#fff1df', sky: '#cbd7e2', intensity: 2.0, ambient: 2.0, position: [-13, 12, -2], exposure: 1, label: 'EARLY MORNING' },
    afternoon: { sun: '#fff2e3', sky: '#c3d1de', intensity: 2.3, ambient: 2.0, position: [-9, 15, 8], exposure: 1, label: 'LATE AFTERNOON' },
    overcast: { sun: '#f5f7fa', sky: '#c8d0d7', intensity: .65, ambient: 2.35, position: [-5, 20, 2], exposure: 1, label: 'UNDER SOFT CLOUDS' },
  };
  const configuration = configurations[lighting];
  sunlight.color.set(configuration.sun); sunlight.intensity = configuration.intensity; sunlight.position.fromArray(configuration.position);
  hemisphere.intensity = configuration.ambient; fillLight.intensity = lighting === 'overcast' ? 1 : .65;
  hemisphere.color.set(lighting === 'overcast' ? '#ecf0f5' : '#e8eef6');
  hemisphere.groundColor.set('#858482');
  scene.background.set(configuration.sky); scene.fog.color.set(configuration.sky); renderer.toneMappingExposure = configuration.exposure;
  document.querySelector('#light-label').textContent = configuration.label;
  document.querySelectorAll('[data-light]').forEach(function markLighting(button) { button.classList.toggle('active', button.dataset.light === lighting); button.setAttribute('aria-pressed', String(button.dataset.light === lighting)); });
}

function clearGhost() {
  if (!ghostStone) return;
  ghostStone.traverse(function disposeGhostMaterial(child) { if (child.isMesh) child.material.dispose(); });
  disposeStone(ghostStone); ghostStone = null;
}

function makeGhost() {
  clearGhost();
  ghostStone = createStone({ positionX: 0, positionZ: 0, shape: chosenStoneShape, size: chosenStoneSize, seed: 87, rotation: 0 }, rockMaterial, mossMaterial);
  ghostStone.traverse(function ghostMaterial(child) { if (child.isMesh) { child.material = child.material.clone(); child.material.transparent = true; child.material.opacity = .42; child.material.depthWrite = false; child.castShadow = false; } });
  ghostStone.visible = false; scene.add(ghostStone);
}

function setTool(tool) {
  renderRequested = true;
  activeTool = tool;
  rakePath = null; rakeCursorPoint = null;
  document.querySelectorAll('[data-tool]').forEach(function markTool(button) { button.classList.toggle('active', button.dataset.tool === tool); button.setAttribute('aria-pressed', String(button.dataset.tool === tool)); });
  document.querySelector('#tool-heading').textContent = toolDescriptions[tool][0];
  document.querySelector('#tool-description').textContent = toolDescriptions[tool][1];
  document.querySelector('#brush-settings').hidden = tool === 'stone';
  document.querySelector('#diameter-caption').textContent = tool === 'rake' ? 'Rake width' : 'Brush diameter';
  document.querySelector('#stone-settings').hidden = tool !== 'stone';
  document.querySelector('#panel-kicker').textContent = tool === 'stone' ? 'COMPOSE IN STONE' : 'MAKE YOUR MARK';
  canvas.style.cursor = tool === 'stone' ? 'copy' : 'crosshair';
  selectedStone = null;
  if (tool === 'stone') makeGhost(); else clearGhost();
}

function setSeason(season) {
  chosenSeason = ['spring', 'summer', 'autumn', 'winter'].includes(season) ? season : 'summer';
  forest.setSeason(chosenSeason);
  gardenAmbience.setSeason(chosenSeason);
  const mossTints = { spring: '#d9d4a2', summer: '#ffffff', autumn: '#d0b179', winter: '#a58a62' };
  mossMaterial.color.set(mossTints[chosenSeason]);
  document.querySelector('#season').value = chosenSeason;
  renderer.shadowMap.needsUpdate = true; renderRequested = true;
}

function updateDiameter(value) {
  renderRequested = true;
  brushDiameter = clamp(Number(value), .4, 4.5);
  document.querySelector('#diameter').value = brushDiameter;
  document.querySelector('#diameter-label').textContent = `${brushDiameter.toFixed(2)} m`;
}

function updateStoneSize(value) {
  const nextSize = clamp(Number(value), .3, 2);
  if (selectedStone && Math.abs(selectedStone.scale.x - nextSize) > .0001) {
    rememberGarden();
    selectedStone.scale.setScalar(nextSize);
    selectedStone.userData.definition.size = nextSize;
    const position = clampStonePosition(selectedStone.position.x, selectedStone.position.z, nextSize);
    selectedStone.position.x = position.x; selectedStone.position.z = position.z;
    selectedStone.userData.definition.positionX = position.x; selectedStone.userData.definition.positionZ = position.z;
    seatStoneOnTerrain(selectedStone, heights);
  }
  chosenStoneSize = nextSize;
  document.querySelector('#stone-size').value = nextSize;
  document.querySelector('#stone-size-label').textContent = `${nextSize.toFixed(2)}×`;
  makeGhost(); renderer.shadowMap.needsUpdate = true; renderRequested = true;
}

function updatePointer(event) {
  renderRequested = true;
  const rectangle = canvas.getBoundingClientRect();
  pointerPosition.set((event.clientX - rectangle.left) / rectangle.width * 2 - 1, -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1);
}

function terrainIntersection() {
  raycaster.setFromCamera(pointerPosition, camera);
  const point = raycaster.ray.intersectPlane(interactionPlane, new THREE.Vector3());
  if (!point || Math.abs(point.x) > 12 || Math.abs(point.z) > 5.75) return null;
  return point;
}

function stoneIntersection() {
  raycaster.setFromCamera(pointerPosition, camera);
  const intersections = raycaster.intersectObjects(stoneGroup.children, true);
  return intersections.length ? intersections[0].object.parent : null;
}

function updateBrushVisual(point) {
  if (activeTool === 'rake') {
    let vertexCount = 0;
    function addRakeVertex(lateralDistance, forwardDistance) {
      rakePositions[vertexCount * 3] = point.x - strokeDirection.y * lateralDistance + strokeDirection.x * forwardDistance;
      rakePositions[vertexCount * 3 + 1] = .035;
      rakePositions[vertexCount * 3 + 2] = point.z + strokeDirection.x * lateralDistance + strokeDirection.y * forwardDistance;
      vertexCount++;
    }
    addRakeVertex(-brushDiameter / 2, RAKE_HALF_DEPTH);
    addRakeVertex(brushDiameter / 2, RAKE_HALF_DEPTH);
    addRakeVertex(0, RAKE_HALF_DEPTH);
    addRakeVertex(0, RAKE_HALF_DEPTH + .4);
    const toothCountPerSide = Math.floor((brushDiameter / 2 - .04) / RAKE_TOOTH_SPACING);
    for (let toothIndex = -toothCountPerSide; toothIndex <= toothCountPerSide; toothIndex++) {
      addRakeVertex(toothIndex * RAKE_TOOTH_SPACING, RAKE_HALF_DEPTH);
      addRakeVertex(toothIndex * RAKE_TOOTH_SPACING, -RAKE_HALF_DEPTH);
    }
    rakeGeometry.setDrawRange(0, vertexCount);
    rakeGeometry.attributes.position.needsUpdate = true;
    rakeGeometry.computeBoundingSphere();
    return;
  }
  for (let segmentIndex = 0; segmentIndex <= 128; segmentIndex++) {
    const angle = segmentIndex / 128 * Math.PI * 2;
    const worldX = point.x + Math.cos(angle) * brushDiameter / 2;
    const worldZ = point.z + Math.sin(angle) * brushDiameter / 2;
    brushPositions[segmentIndex * 3] = worldX;
    brushPositions[segmentIndex * 3 + 1] = .035;
    brushPositions[segmentIndex * 3 + 2] = worldZ;
  }
  brushGeometry.attributes.position.needsUpdate = true;
  brushGeometry.computeBoundingSphere();
}

function stampStroke(point, elapsedSeconds) {
  if (!lastStrokePoint) lastStrokePoint = point.clone();
  const movementX = point.x - lastStrokePoint.x;
  const movementZ = point.z - lastStrokePoint.z;
  const movementDistance = Math.hypot(movementX, movementZ);
  if (activeTool === 'rake') {
    if (movementDistance < .002) return;
    const targetAngle = rakeHeadingAngle;
    const contact = planRakeContact(Math.atan2(strokeDirection.y, strokeDirection.x), targetAngle, movementX, movementZ, rakeStrokeHasMoved);
    if (contact.shouldLift) {
      strokeDirection.set(Math.cos(targetAngle), Math.sin(targetAngle));
      lastStrokePoint.copy(point); rakeStrokeHasMoved = false;
      return;
    }
    const previousAngle = contact.startAngle;
    const turnAngle = contact.turnAngle;
    const stampCount = Math.max(1, Math.ceil((movementDistance + Math.abs(turnAngle) * brushDiameter / 2) / .04));
    for (let stampIndex = 1; stampIndex <= stampCount; stampIndex++) {
      const fraction = stampIndex / stampCount;
      const stampAngle = previousAngle + turnAngle * fraction;
      applyBrush(heights, { worldX: lastStrokePoint.x + movementX * fraction, worldZ: lastStrokePoint.z + movementZ * fraction, radius: brushDiameter / 2, pressure: brushPressure, tool: 'rake', directionX: Math.cos(stampAngle), directionZ: Math.sin(stampAngle), elapsedSeconds: movementDistance / stampCount, referenceHeights: rakeReferenceHeights });
    }
    strokeDirection.set(Math.cos(previousAngle + turnAngle), Math.sin(previousAngle + turnAngle));
    rakeStrokeHasMoved = true;
    lastStrokePoint.copy(point); terrainNeedsUpdate = true;
    return;
  }
  if (movementDistance > .002) strokeDirection.set(movementX, movementZ).normalize();
  if (activeTool === 'push' && movementDistance < .002) return;
  const stampCount = Math.max(1, Math.ceil(movementDistance / Math.min(.09, brushDiameter * .12)));
  for (let stampIndex = 1; stampIndex <= stampCount; stampIndex++) {
    const fraction = stampIndex / stampCount;
    applyBrush(heights, { worldX: lastStrokePoint.x + movementX * fraction, worldZ: lastStrokePoint.z + movementZ * fraction, radius: brushDiameter / 2, pressure: brushPressure, tool: activeTool, directionX: strokeDirection.x, directionZ: strokeDirection.y, elapsedSeconds: Math.min(.05, elapsedSeconds) / stampCount });
  }
  lastStrokePoint.copy(point); terrainNeedsUpdate = true;
}

canvas.addEventListener('pointerdown', function beginGesture(event) {
  if (event.button !== 0 || isContemplating) return;
  updatePointer(event); pointerIsInside = true;
  const point = terrainIntersection();
  if (!point) return;
  canvas.setPointerCapture(event.pointerId);
  if (activeTool === 'stone') {
    const hitStone = stoneIntersection();
    rememberGarden();
    if (hitStone) {
      selectedStone = hitStone; draggedStone = hitStone; canvas.style.cursor = 'grabbing';
      chosenStoneSize = hitStone.userData.definition.size;
      document.querySelector('#stone-size').value = chosenStoneSize;
      document.querySelector('#stone-size-label').textContent = `${chosenStoneSize.toFixed(2)}×`;
    }
    else {
      if (stoneGroup.children.length >= 80) { history.pop(); showToast('Let the stones breathe. Move or remove one first.'); return; }
      const position = clampStonePosition(point.x, point.z, chosenStoneSize);
      selectedStone = addStone({ positionX: position.x, positionZ: position.z, shape: chosenStoneShape, size: chosenStoneSize, rotation: ghostStone ? ghostStone.rotation.y : 0, seed: 100 + Math.floor(Math.random() * 100000) });
      renderer.shadowMap.needsUpdate = true;
      showToast('A new island. R to rotate; drag to move.');
    }
  } else {
    rememberGarden(); isSculpting = true; lastStrokePoint = point.clone(); rakeStrokeHasMoved = false;
    rakeReferenceHeights = activeTool === 'rake' ? heights.slice() : null;
    rakePath = createRakePath(point.x, point.z); rakeCursorPoint = point.clone();
  }
});

function clampStonePosition(worldX, worldZ, size) { return { x: clamp(worldX, -11.7 + size, 11.7 - size), z: clamp(worldZ, -5.45 + size * .8, 5.45 - size * .8) }; }

canvas.addEventListener('pointermove', function movePointer(event) {
  updatePointer(event); pointerIsInside = true;
  if (activeTool === 'rake') {
    const point = terrainIntersection();
    if (point && (isSculpting || event.buttons === 0)) {
      if (!rakePath) {
        rakePath = createRakePath(point.x, point.z);
        rakeCursorPoint = point.clone(); lastStrokePoint = point.clone();
      }
      for (const sample of advanceRakePath(rakePath, point.x, point.z)) {
        const smoothedPoint = new THREE.Vector3(sample.worldX, 0, sample.worldZ);
        rakeHeadingAngle = Math.atan2(sample.directionZ, sample.directionX);
        if (isSculpting) stampStroke(smoothedPoint, 0);
        else strokeDirection.set(Math.cos(rakeHeadingAngle), Math.sin(rakeHeadingAngle));
        rakeCursorPoint = smoothedPoint;
      }
    } else { rakePath = null; rakeCursorPoint = null; lastStrokePoint = null; rakeStrokeHasMoved = false; }
  }
  if (draggedStone) {
    const point = terrainIntersection();
    if (point) {
      const position = clampStonePosition(point.x, point.z, draggedStone.userData.definition.size);
      draggedStone.position.x = position.x; draggedStone.position.z = position.z;
      seatStoneOnTerrain(draggedStone, heights);
      draggedStone.userData.definition.positionX = position.x; draggedStone.userData.definition.positionZ = position.z;
      renderer.shadowMap.needsUpdate = true;
    }
  }
});

function endGesture() { isSculpting = false; draggedStone = null; lastStrokePoint = null; rakeReferenceHeights = null; canvas.style.cursor = activeTool === 'stone' ? 'copy' : 'crosshair'; }
window.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', endGesture);
canvas.addEventListener('lostpointercapture', endGesture);
window.addEventListener('blur', function loseFocus() { endGesture(); pointerIsInside = false; });
canvas.addEventListener('pointerleave', function leaveGarden() { pointerIsInside = false; renderRequested = true; });
canvas.addEventListener('contextmenu', function preventMenu(event) { event.preventDefault(); });

document.querySelectorAll('[data-tool]').forEach(function connectTool(button) { button.addEventListener('click', function chooseTool() { setTool(button.dataset.tool); }); });
function selectStoneShape(shape) {
  endGesture();
  chosenStoneShape = shape;
  document.querySelectorAll('[data-shape]').forEach(function markShape(button) {
    const selected = button.dataset.shape === shape;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  setTool('stone');
}
document.querySelectorAll('[data-shape]').forEach(function connectShape(button) { button.addEventListener('click', function chooseShape() { selectStoneShape(button.dataset.shape); }); });
document.querySelectorAll('[data-light]').forEach(function connectLighting(button) { button.addEventListener('click', function changeLight() { setLighting(button.dataset.light); }); });
document.querySelector('#season').addEventListener('change', function changeSeason(event) { setSeason(event.target.value); });
document.querySelector('#diameter').addEventListener('input', function changeDiameter(event) { updateDiameter(event.target.value); });
document.querySelector('#strength').addEventListener('input', function changePressure(event) { brushPressure = Number(event.target.value) / 100; document.querySelector('#strength-label').textContent = `${event.target.value}%`; });
document.querySelector('#stone-size').addEventListener('input', function changeStoneSize(event) {
  updateStoneSize(event.target.value);
});
document.querySelector('#undo-button').addEventListener('click', undo);
document.querySelector('#save-button').addEventListener('click', function saveGarden() {
  try { localStorage.setItem(storageKey, JSON.stringify(serializeGarden())); document.querySelector('#save-status').textContent = 'Saved in this browser. Come back whenever.'; showToast('This moment is yours to return to.'); }
  catch { showToast('Browser storage is unavailable. Your garden is still here for this visit.'); }
});

const guideDialog = document.querySelector('#guide-dialog');
document.querySelector('#help-button').addEventListener('click', function openGuide() { guideDialog.showModal(); });
guideDialog.querySelector('.dialog-close').addEventListener('click', function closeGuide() { guideDialog.close(); });
const resetDialog = document.querySelector('#reset-dialog');
document.querySelector('#reset-button').addEventListener('click', function openReset() { resetDialog.showModal(); });
document.querySelector('#cancel-reset').addEventListener('click', function cancelReset() { resetDialog.close(); });
document.querySelector('#confirm-reset').addEventListener('click', function resetGarden() { rememberGarden(); restoreGarden({ heights: createInitialHeights(originalStones), stones: originalStones }); resetDialog.close(); showToast('A fresh beginning.'); });
document.querySelector('#clear-button').addEventListener('click', function clearGarden() {
  rememberGarden();
  restoreGarden({ heights: new Float32Array(COLUMN_COUNT * ROW_COUNT), stones: [] });
  showToast('An open space. Undo brings everything back.');
});

const toolDock = document.querySelector('#tool-dock');
const toolSign = document.querySelector('#tool-sign');
document.querySelector('#tool-panel').append(document.querySelector('.header-actions'));
document.querySelector('#tool-panel').insertBefore(document.querySelector('.toolbar'), document.querySelector('#brush-settings'));
let closeToolsTimeout;
function openTools() {
  clearTimeout(closeToolsTimeout);
  document.body.classList.add('tools-open'); toolSign.setAttribute('aria-expanded', 'true');
  document.querySelector('#tool-panel').inert = false;
  document.querySelector('.toolbar').inert = false;
}
function closeTools() {
  document.body.classList.remove('tools-open'); toolSign.setAttribute('aria-expanded', 'false');
  document.querySelector('#tool-panel').inert = true;
  document.querySelector('.toolbar').inert = true;
}
toolDock.addEventListener('pointerenter', function revealTools(event) { if (event.pointerType !== 'touch') openTools(); });
toolDock.addEventListener('pointerleave', function foldTools() { closeToolsTimeout = setTimeout(closeTools, 250); });
toolDock.addEventListener('focusin', openTools);
toolDock.addEventListener('focusout', function leaveTools(event) { if (!toolDock.contains(event.relatedTarget)) closeToolsTimeout = setTimeout(closeTools, 250); });
toolSign.addEventListener('click', openTools);
canvas.addEventListener('pointerdown', closeTools);
closeTools();

let viewTransition = null;
function configureViewLimits() {
  controls.minDistance = isElevatedView ? 9 : 9.5;
  controls.maxDistance = isElevatedView ? 23 : 12.3;
  controls.minPolarAngle = isElevatedView ? .17 : 1.34;
  controls.maxPolarAngle = isElevatedView ? 1.15 : 1.44;
  controls.minAzimuthAngle = isElevatedView ? -.95 : -.36;
  controls.maxAzimuthAngle = isElevatedView ? .95 : .36;
}
document.querySelector('#view-button').addEventListener('click', function changeView() {
  isElevatedView = !isElevatedView;
  temple.visible = !isElevatedView;
  renderer.shadowMap.needsUpdate = true; renderRequested = true;
  controls.minDistance = 5; controls.maxDistance = 24;
  controls.minPolarAngle = .17; controls.maxPolarAngle = 1.5;
  viewTransition = { startPosition: camera.position.clone(), startTarget: controls.target.clone(), endPosition: new THREE.Vector3(...(isElevatedView ? [0, 14, 12.5] : [0, 2.7, 11.25])), endTarget: new THREE.Vector3(0, isElevatedView ? .2 : .38, -.6), elapsed: 0 };
  // The veranda roof is behind the elevated camera's sightline once it rises.
  document.querySelector('#view-button').innerHTML = `${isElevatedView ? 'Above the garden' : 'On the veranda'} <span>⇄</span>`;
});

function setContemplating(value) {
  renderRequested = true;
  isContemplating = value; endGesture(); document.body.classList.toggle('contemplating', value); document.querySelector('#return-button').hidden = !value;
  controls.mouseButtons.LEFT = value ? THREE.MOUSE.ROTATE : null;
  controls.touches.ONE = value ? THREE.TOUCH.ROTATE : null;
  canvas.style.cursor = value ? 'grab' : 'crosshair';
  if (value) showToast('Just sit for a while.');
}
document.querySelector('#contemplate-button').addEventListener('click', function contemplate() { setContemplating(true); });
document.querySelector('#return-button').addEventListener('click', function returnToTools() { setContemplating(false); });

window.addEventListener('keydown', function handleKey(event) {
  if (guideDialog.open || resetDialog.open) return;
  if (event.key === 'Escape') { setContemplating(false); closeTools(); return; }
  if (event.target.matches('input, textarea, select') || event.target.isContentEditable) return;
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); performanceMeter.hidden = !performanceMeter.hidden; return; }
  if (isContemplating) return;
  if (event.key === '[' || event.key === ']') {
    event.preventDefault();
    const adjustment = event.key === '[' ? -1 : 1;
    if (activeTool === 'stone') updateStoneSize((selectedStone ? selectedStone.userData.definition.size : chosenStoneSize) + adjustment * .1);
    else updateDiameter(brushDiameter + adjustment * .15);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return; }
  if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    const stoneShapeHotkeys = { '7': 'spire', z: 'spire', '8': 'reclining', x: 'reclining', '9': 'mountain', c: 'mountain', '0': 'split', v: 'split' };
    const shape = stoneShapeHotkeys[event.key.toLowerCase()];
    if (shape) { event.preventDefault(); if (!event.repeat) selectStoneShape(shape); return; }
  }
  if (/^[1-6]$/.test(event.key)) setTool(['rake', 'raise', 'press', 'push', 'smooth', 'stone'][Number(event.key) - 1]);
  if (event.key.toLowerCase() === 'r' && activeTool === 'stone') {
    renderer.shadowMap.needsUpdate = true; renderRequested = true;
    if (selectedStone) { rememberGarden(); selectedStone.rotation.y += Math.PI / 9; selectedStone.userData.definition.rotation = selectedStone.rotation.y; seatStoneOnTerrain(selectedStone, heights); }
    else if (ghostStone) ghostStone.rotation.y += Math.PI / 9;
  }
  if ((event.key.toLowerCase() === 'e' || event.key === 'Delete' || event.key === 'Backspace') && activeTool === 'stone') {
    const stoneToErase = selectedStone || (pointerIsInside ? stoneIntersection() : null);
    if (stoneToErase) { event.preventDefault(); rememberGarden(); disposeStone(stoneToErase); selectedStone = null; draggedStone = null; updateStoneCount(); showToast('A little more space.'); }
  }
});

let soundEnabled = false;
document.querySelector('#sound-button').addEventListener('click', async function toggleSound() {
  const soundButton = document.querySelector('#sound-button');
  soundButton.disabled = true;
  try {
    soundEnabled = await gardenAmbience.setEnabled(!soundEnabled);
    soundButton.style.background = soundEnabled ? '#a9b38355' : '';
    soundButton.setAttribute('aria-label', soundEnabled ? 'Disable seasonal nature sounds' : 'Enable seasonal nature sounds');
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    showToast(soundEnabled ? 'A little breeze, with cicadas in summer.' : 'Quiet again.');
  } catch {
    showToast('Sound could not start. Try the sound button again.');
  } finally {
    soundButton.disabled = false;
  }
});

window.addEventListener('resize', function resizeGarden() {
  renderRequested = true;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  ambientOcclusion.setSize(Math.ceil(innerWidth * .65), Math.ceil(innerHeight * .65));
});
canvas.addEventListener('webglcontextlost', function contextLost(event) { event.preventDefault(); showToast('The graphics context paused. Reload to return to your last saved garden.'); });

for (const definition of originalStones) addStone(definition);
try {
  const serialized = localStorage.getItem(storageKey);
  if (serialized) {
    const saved = JSON.parse(serialized);
    if (validateSavedGarden(saved)) { restoreGarden(saved); setSeason(saved.season); setLighting(['morning', 'afternoon', 'overcast'].includes(saved.lighting) ? saved.lighting : 'afternoon'); document.querySelector('#save-status').textContent = 'Welcome back to your garden.'; }
  }
} catch { /* Storage may be disabled; the garden remains fully playable. */ }
updateTerrain(); setTool('rake');
document.querySelector('#undo-button').disabled = true;
const frameClock = new THREE.Clock();
const performanceMeter = document.createElement('output');
performanceMeter.id = 'performance-meter'; performanceMeter.hidden = true;
performanceMeter.textContent = 'Measuring…'; performanceMeter.title = 'Rendered frames per second. Move or sculpt to measure; F hides this readout.';
document.querySelector('#experience').append(performanceMeter);
let frameWindowStart = performance.now();
let framesRenderedInWindow = 0;
let measuredFramesPerSecond = 0;
document.addEventListener('visibilitychange', function pauseHiddenGarden() {
  if (document.hidden) { endGesture(); pointerIsInside = false; }
  gardenAmbience.setHidden(document.hidden);
  frameWindowStart = performance.now(); framesRenderedInWindow = 0;
  renderRequested = true;
});
let frameCount = 0;
function animate() {
  requestAnimationFrame(animate);
  const frameDuration = frameClock.getDelta();
  if (document.hidden) return;
  const elapsedSeconds = Math.min(frameDuration, .06);
  const breezeChanged = forest.breeze.update(frameDuration, reducedMotionPreference.matches);
  gardenAmbience.update(forest.breeze.inspect().strength);
  if (viewTransition) {
    viewTransition.elapsed += frameDuration;
    const fraction = Math.min(1, viewTransition.elapsed / 1.1);
    const easedFraction = fraction * fraction * (3 - 2 * fraction);
    camera.position.lerpVectors(viewTransition.startPosition, viewTransition.endPosition, easedFraction);
    controls.target.lerpVectors(viewTransition.startTarget, viewTransition.endTarget, easedFraction);
    if (fraction === 1) { viewTransition = null; configureViewLimits(); }
  }
  const cameraChanged = controls.update();
  if (cameraChanged && !isSculpting) { rakePath = null; rakeCursorPoint = null; }
  if (terrainNeedsUpdate) updateTerrain();
  const point = pointerIsInside && !isContemplating ? terrainIntersection() : null;
  brushRing.visible = !!point && activeTool !== 'stone' && activeTool !== 'rake';
  rakeBar.visible = !!point && activeTool === 'rake';
  if (point && activeTool !== 'stone') {
    updateBrushVisual(activeTool === 'rake' && rakeCursorPoint ? rakeCursorPoint : point);
    if (isSculpting && activeTool !== 'rake') stampStroke(point, elapsedSeconds);
  }
  if (ghostStone) {
    ghostStone.visible = !!point && !isContemplating && !draggedStone && !stoneIntersection();
    if (point && ghostStone.visible) { const position = clampStonePosition(point.x, point.z, chosenStoneSize); ghostStone.position.x = position.x; ghostStone.position.z = position.z; seatStoneOnTerrain(ghostStone, heights, terrainRevision); }
  }
  selectionRing.visible = !!selectedStone && !isContemplating;
  if (selectedStone) { selectionRing.position.copy(selectedStone.position); selectionRing.position.y += .08; selectionRing.scale.setScalar(selectedStone.userData.definition.size * 1.4); }
  if (frameCount < 3 || renderRequested || breezeChanged || cameraChanged || (isSculpting && activeTool !== 'rake') || viewTransition) {
    composer.render(); renderRequested = false; framesRenderedInWindow++;
  }
  const frameWindowEnd = performance.now();
  if (frameWindowEnd - frameWindowStart >= 1000) {
    measuredFramesPerSecond = framesRenderedInWindow * 1000 / (frameWindowEnd - frameWindowStart);
    performanceMeter.textContent = framesRenderedInWindow ? `${Math.round(measuredFramesPerSecond)} fps` : 'Idle · no rendering';
    frameWindowStart = frameWindowEnd; framesRenderedInWindow = 0;
  }
  frameCount++;
  if (frameCount === 3) {
    const loading = document.querySelector('#loading');
    document.body.classList.remove('is-loading');
    loading.style.opacity = '0';
    setTimeout(function removeLoading() { loading.hidden = true; renderRequested = true; }, 700);
  }
}
animate();

// Read-only diagnostics for the local browser verification harness. Bundled
// application entry-point exports are removed by the production build.
export function inspectGarden() {
  const point = terrainIntersection();
  return { cameraPosition: camera.position.toArray(), groundPoint: point ? point.toArray() : null, isElevatedView, stoneCount: stoneGroup.children.length, selectedStoneSize: selectedStone ? selectedStone.userData.definition.size : null, chosenStoneSize, minimumPolarAngle: controls.minPolarAngle, rakeBarVisible: rakeBar.visible, brushRingVisible: brushRing.visible, rakeDirection: strokeDirection.toArray(), rakeGroundPosition: rakePath ? [rakePath.secondX, rakePath.secondZ] : null, brushDiameter, chosenSeason, breeze: forest.breeze.inspect(), ambience: gardenAmbience.inspect(), forest: forest.inspectSeason(), terrainHeightEnergy: heights.reduce(function sumSquaredHeight(total, height) { return total + height * height; }, 0) };
}
