import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createForest } from './forest.js';
import { enrichStoneMaterial } from './stone-material.js';
import { GARDEN_WIDTH, GARDEN_DEPTH, COLUMN_COUNT, ROW_COUNT } from './terrain.js';

export function seededRandom(seed) {
  let currentSeed = seed;
  return function randomNumber() { currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0; return currentSeed / 4294967296; };
}

function createSurfaceTexture(kind, seed) {
  const randomNumber = seededRandom(seed);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d');
  const baseColors = { sand: '#c5c7c7', wood: '#59483e', wall: '#b79a7b', rock: '#6f7174', moss: '#596633', curb: '#96999b' };
  context.fillStyle = baseColors[kind];
  context.fillRect(0, 0, 1024, 1024);
  const imageData = context.getImageData(0, 0, 1024, 1024);
  for (let pixelIndex = 0; pixelIndex < imageData.data.length; pixelIndex += 4) {
    const noiseAmount = (randomNumber() - .5) * (kind === 'sand' ? 45 : 38);
    imageData.data[pixelIndex] += noiseAmount;
    imageData.data[pixelIndex + 1] += noiseAmount;
    imageData.data[pixelIndex + 2] += noiseAmount;
  }
  context.putImageData(imageData, 0, 0);
  if (kind === 'rock' || kind === 'moss') {
    for (let patchIndex = 0; patchIndex < 1600; patchIndex++) {
      const patchX = randomNumber() * 1024, patchY = randomNumber() * 1024;
      const patchRadius = 3 + randomNumber() * 45;
      const gradient = context.createRadialGradient(patchX, patchY, 0, patchX, patchY, patchRadius);
      gradient.addColorStop(0, randomNumber() > .55 ? 'rgba(225,226,201,.19)' : 'rgba(22,30,22,.22)');
      gradient.addColorStop(1, 'rgba(50,60,40,0)');
      context.fillStyle = gradient; context.fillRect(patchX - patchRadius, patchY - patchRadius, patchRadius * 2, patchRadius * 2);
    }
  }
  for (let markIndex = 0; markIndex < (kind === 'sand' ? 24000 : 7500); markIndex++) {
    const markX = randomNumber() * 1024;
    const markY = randomNumber() * 1024;
    const markSize = randomNumber() * (kind === 'wall' ? 10 : 2.5) + .4;
    context.fillStyle = randomNumber() > .5 ? 'rgba(250,250,250,.10)' : 'rgba(24,25,26,.12)';
    if (kind === 'wood') context.fillRect(markX, markY, .5 + randomNumber(), randomNumber() * 180 + 20);
    else { context.beginPath(); context.ellipse(markX, markY, markSize, markSize * .6, randomNumber() * Math.PI, 0, Math.PI * 2); context.fill(); }
  }
  if (kind === 'wall') {
    for (let stripeIndex = 0; stripeIndex < 70; stripeIndex++) {
      const stripeY = randomNumber() * 1024;
      const gradient = context.createLinearGradient(0, stripeY, 0, stripeY + 30);
      gradient.addColorStop(0, 'rgba(53,51,32,0)'); gradient.addColorStop(.5, 'rgba(53,51,32,.07)'); gradient.addColorStop(1, 'rgba(53,51,32,0)');
      context.fillStyle = gradient; context.fillRect(0, stripeY, 1024, 30);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createMaterial(kind, seed, repetitionX, repetitionY) {
  const texture = createSurfaceTexture(kind, seed);
  texture.repeat.set(repetitionX, repetitionY);
  return new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: kind === 'sand' ? .045 : .065, roughness: kind === 'wood' ? .76 : .98 });
}

function box(parent, width, height, depth, positionX, positionY, positionZ, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(positionX, positionY, positionZ); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

function mergeStaticMeshes(parent, excludedMesh) {
  parent.updateMatrixWorld(true);
  const materialGroups = new Map();
  parent.traverse(function gatherMesh(mesh) {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh === excludedMesh) return;
    if (!materialGroups.has(mesh.material)) materialGroups.set(mesh.material, []);
    materialGroups.get(mesh.material).push(mesh);
  });
  for (const [material, meshes] of materialGroups) {
    if (meshes.length < 2) continue;
    const transformedGeometries = meshes.map(function transformedGeometry(mesh) { return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); });
    const merged = new THREE.Mesh(mergeGeometries(transformedGeometries), material);
    merged.castShadow = true; merged.receiveShadow = true;
    for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); }
    for (const geometry of transformedGeometries) geometry.dispose();
    parent.add(merged);
  }
}

function createLeafTexture(species = 'broadleaf') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const randomNumber = seededRandom(78);
  if (species === 'canopy') { context.fillStyle = '#777777'; context.fillRect(0, 0, 128, 128); }
  context.strokeStyle = '#929292'; context.lineWidth = 1.7;
  context.beginPath(); context.moveTo(64, 124); context.bezierCurveTo(49, 76, 84, 47, 63, 7); context.stroke();
  for (let leafIndex = 0; leafIndex < (species === 'canopy' ? 380 : 27); leafIndex++) {
    const centerX = species === 'canopy' ? randomNumber() * 128 : 20 + randomNumber() * 88;
    const centerY = species === 'canopy' ? randomNumber() * 128 : 8 + randomNumber() * 104;
    const leafLength = species === 'canopy' ? 2 + randomNumber() * 5 : 7 + randomNumber() * 11;
    context.save(); context.translate(centerX, centerY); context.rotate(randomNumber() * Math.PI * 2);
    const gradient = context.createLinearGradient(-leafLength, 0, leafLength, 0);
    gradient.addColorStop(0, '#aaaaaa'); gradient.addColorStop(.5, '#dedede'); gradient.addColorStop(1, '#929292');
    context.fillStyle = gradient;
    if (species === 'conifer') {
      context.strokeStyle = '#d0d0d0'; context.lineWidth = 1.4;
      for (let needleIndex = 0; needleIndex < 8; needleIndex++) {
        const needlePosition = (needleIndex / 7 - .5) * leafLength * 2;
        context.beginPath(); context.moveTo(needlePosition, 0); context.lineTo(needlePosition + leafLength * .45, -leafLength * .55); context.moveTo(needlePosition, 0); context.lineTo(needlePosition + leafLength * .45, leafLength * .55); context.stroke();
      }
    } else if (species === 'cherry') {
      for (let petalIndex = 0; petalIndex < 5; petalIndex++) {
        const petalAngle = petalIndex * Math.PI * 2 / 5;
        context.beginPath(); context.ellipse(Math.cos(petalAngle) * leafLength * .37, Math.sin(petalAngle) * leafLength * .37, leafLength * .37, leafLength * .24, petalAngle, 0, Math.PI * 2); context.fill();
      }
    } else if (species === 'maple') {
      context.beginPath();
      for (let pointIndex = 0; pointIndex < 14; pointIndex++) {
        const angle = pointIndex / 14 * Math.PI * 2;
        const radius = leafLength * (pointIndex % 2 === 0 ? 1 : .38);
        if (pointIndex === 0) context.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      context.closePath(); context.fill();
    } else {
      context.beginPath(); context.moveTo(-leafLength, 0); context.quadraticCurveTo(0, -leafLength * .7, leafLength, 0); context.quadraticCurveTo(0, leafLength * .7, -leafLength, 0); context.fill();
    }
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export const originalStones = [
  { positionX: -8.2, positionZ: .1, shape: 'mountain', size: .91, rotation: .2, seed: 21 },
  { positionX: -9.02, positionZ: .28, shape: 'reclining', size: .48, rotation: -.5, seed: 22 },
  { positionX: -7.48, positionZ: .46, shape: 'spire', size: .43, rotation: .8, seed: 23 },
  { positionX: -8.35, positionZ: .84, shape: 'reclining', size: .34, rotation: 1.1, seed: 24 },
  { positionX: -8.95, positionZ: -.38, shape: 'mountain', size: .34, rotation: 0, seed: 25 },
  { positionX: -4.35, positionZ: -3.15, shape: 'spire', size: .72, rotation: -.4, seed: 31 },
  { positionX: -3.62, positionZ: -2.98, shape: 'reclining', size: .43, rotation: .5, seed: 32 },
  { positionX: .1, positionZ: -.85, shape: 'mountain', size: .63, rotation: 1.1, seed: 41 },
  { positionX: -.67, positionZ: -.51, shape: 'reclining', size: .49, rotation: .2, seed: 42 },
  { positionX: .65, positionZ: -.48, shape: 'spire', size: .36, rotation: -.8, seed: 43 },
  { positionX: 4.35, positionZ: -3.5, shape: 'reclining', size: .65, rotation: -.3, seed: 51 },
  { positionX: 5.03, positionZ: -3.6, shape: 'spire', size: .47, rotation: .8, seed: 52 },
  { positionX: 8.05, positionZ: .15, shape: 'split', size: .72, rotation: .5, seed: 61 },
  { positionX: 8.71, positionZ: .57, shape: 'reclining', size: .46, rotation: -.4, seed: 62 },
  { positionX: 7.36, positionZ: .52, shape: 'mountain', size: .34, rotation: 0, seed: 63 },
];

export function createGardenScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c3d1de');
  scene.fog = new THREE.Fog('#c3d1de', 60, 150);
  const hemisphere = new THREE.HemisphereLight('#e8eef6', '#858482', 2.0); scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#fff2e3', 2.3);
  sunlight.position.set(-9, 15, 8); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048); sunlight.shadow.camera.left = -18; sunlight.shadow.camera.right = 18; sunlight.shadow.camera.top = 16; sunlight.shadow.camera.bottom = -16;
  sunlight.shadow.camera.near = .1; sunlight.shadow.camera.far = 65; sunlight.shadow.normalBias = .035; sunlight.shadow.bias = -.00015; sunlight.shadow.radius = 4;
  scene.add(sunlight);
  const fillLight = new THREE.DirectionalLight('#dce6f2', .65); fillLight.position.set(12, 8, 10); scene.add(fillLight);
  const woodMaterial = createMaterial('wood', 45, 1, 3);
  const wallMaterial = createMaterial('wall', 52, 5, 1);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#4d5149', roughness: .92 });
  const foundationMaterial = new THREE.MeshStandardMaterial({ color: '#74787a', roughness: 1 });
  const sandMaterial = createMaterial('sand', 13, 18, 9);
  sandMaterial.vertexColors = true;
  const sandGeometry = new THREE.PlaneGeometry(GARDEN_WIDTH, GARDEN_DEPTH, COLUMN_COUNT - 1, ROW_COUNT - 1);
  sandGeometry.rotateX(-Math.PI / 2);
  sandGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COLUMN_COUNT * ROW_COUNT * 3).fill(1), 3));
  const sand = new THREE.Mesh(sandGeometry, sandMaterial); sand.receiveShadow = true; scene.add(sand);
  box(scene, 25.6, .35, 13, 0, -.92, 0, foundationMaterial);
  const soilMaterial = new THREE.MeshStandardMaterial({ color: '#454b31', roughness: 1 });
  box(scene, 140, .2, 140, 0, -.95, -20, soilMaterial);
  // The garden is enclosed on three sides; the fourth opens onto the hōjō.
  for (const side of [-1, 1]) {
    box(scene, .48, 2.1, 13.3, side * 12.65, .9, -.15, wallMaterial);
    box(scene, .7, .36, 13.6, side * 12.65, -.08, -.15, foundationMaterial);
    const cap = box(scene, 1.02, .16, 13.9, side * 12.65, 2.08, -.15, roofMaterial); cap.rotation.z = side * .09;
    for (let tileIndex = 0; tileIndex < 67; tileIndex++) {
      const tile = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.05, 8, 1, false, 0, Math.PI), roofMaterial);
      tile.rotation.z = Math.PI / 2; tile.position.set(side * 12.65, 2.16, -6.9 + tileIndex * .207); tile.castShadow = true; scene.add(tile);
    }
  }
  box(scene, 25.7, 2.1, .45, 0, .9, -6.65, wallMaterial);
  box(scene, 25.8, .35, .68, 0, -.06, -6.65, foundationMaterial);
  for (const slope of [-1, 1]) {
    const cap = box(scene, 26.1, .12, .58, 0, 2.13, -6.65 + slope * .24, roofMaterial); cap.rotation.x = slope * .23;
  }
  for (let tileIndex = 0; tileIndex < 127; tileIndex++) {
    const tile = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, 1.12, 8, 1, false, 0, Math.PI), roofMaterial);
    tile.rotation.x = Math.PI / 2; tile.position.set(-13 + tileIndex * .205, 2.21, -6.65); tile.castShadow = true; scene.add(tile);
  }
  // Pale weathered edging and dark drainage stones are distinct materials in
  // the photo references. Keep yellow out of their intrinsic surface colors;
  // the sunlight and sky fill supply their warm/cool shifts.
  const borderMaterial = createMaterial('curb', 68, 1, 1);
  borderMaterial.bumpScale = .018;
  const gutterBedMaterial = new THREE.MeshStandardMaterial({ color: '#30363a', roughness: 1 });
  for (const side of [-1, 1]) {
    box(scene, 24.7, .045, .30, 0, -.085, side * 6.15, gutterBedMaterial);
    box(scene, .36, .045, 12.3, side * 12.22, -.085, 0, gutterBedMaterial);
  }
  for (let borderIndex = 0; borderIndex < 60; borderIndex++) {
    box(scene, .39, .12, .24, -11.8 + borderIndex * .4, .015, 5.89, borderMaterial);
    box(scene, .39, .12, .24, -11.8 + borderIndex * .4, .015, -5.89, borderMaterial);
  }
  // Deep eaves, exposed rafters, polished planks and the shaded temple interior.
  const temple = new THREE.Group(); scene.add(temple);
  box(temple, 33, .48, 5.5, 0, -.1, 9.25, woodMaterial);
  const plankMaterials = Array.from({ length: 7 }, function plankMaterial(unused, colorIndex) { const material = woodMaterial.clone(); material.color.setHSL(.095, .16, .56 + colorIndex * .015); return material; });
  for (let plankIndex = 0; plankIndex < 85; plankIndex++) {
    const plankMaterial = plankMaterials[plankIndex % 7];
    box(temple, .375, .09, 5.5, -16 + plankIndex * .385, .18, 9.25, plankMaterial);
  }
  box(temple, 33, .19, .22, 0, .12, 6.49, woodMaterial);
  box(temple, 33, .15, .65, 0, -.15, 6.15, woodMaterial);
  const columnLinePositionZ = 7.65;
  for (const postX of [-13.3, -5.6, 5.6, 13.3]) {
    box(temple, .23, 4.2, .29, postX, 2.15, columnLinePositionZ, woodMaterial);
    box(temple, .38, .15, .4, postX, .32, columnLinePositionZ, woodMaterial);
  }
  box(temple, 33, .32, .45, 0, 4.13, columnLinePositionZ, woodMaterial);
  box(temple, 33, .2, 7.9, 0, 4.45, 9.3, woodMaterial);
  for (let rafterIndex = 0; rafterIndex < 57; rafterIndex++) box(temple, .11, .22, 7.5, -16 + rafterIndex * .58, 4.25, 9.05, woodMaterial);
  box(temple, 33, .17, .3, 0, 4.31, 5.37, woodMaterial);
  const screenMaterial = new THREE.MeshStandardMaterial({ color: '#c5baa0', roughness: 1 });
  box(temple, 33, 4.3, .16, 0, 2.2, 11.9, screenMaterial);
  for (let panelIndex = 0; panelIndex < 60; panelIndex++) box(temple, .055, 4.3, .1, -16 + panelIndex * .55, 2.2, 11.77, woodMaterial);
  for (let railIndex = 0; railIndex < 9; railIndex++) box(temple, 33, .04, .1, 0, railIndex * .48 + .35, 11.77, woodMaterial);
  mergeStaticMeshes(temple);
  scene.remove(temple);
  const forest = createForest(scene, createLeafTexture, seededRandom(500));
  const randomNumber = seededRandom(501);
  const transform = new THREE.Object3D();
  const pebbleGeometry = new THREE.IcosahedronGeometry(1, 0);
  const pebbleMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .96 });
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, 1600);
  const pebblePalette = ['#394147', '#444b50', '#50575c', '#5a6064', '#676c6e', '#74787a'];
  const pebbleColor = new THREE.Color();
  const pebbleColorRandom = seededRandom(502);
  for (let pebbleIndex = 0; pebbleIndex < 1600; pebbleIndex++) {
    const isSide = pebbleIndex % 2 === 0;
    const side = randomNumber() > .5 ? 1 : -1;
    transform.position.set(isSide ? side * (12.05 + randomNumber() * .32) : (randomNumber() - .5) * 24, -.01, isSide ? (randomNumber() - .5) * 11.7 : side * (6 + randomNumber() * .2));
    transform.scale.set(.04 + randomNumber() * .065, .03 + randomNumber() * .04, .04 + randomNumber() * .065); transform.rotation.set(randomNumber() * 3, randomNumber() * 3, 0); transform.updateMatrix(); pebbles.setMatrixAt(pebbleIndex, transform.matrix);
    pebbleColor.set(pebblePalette[Math.floor(pebbleColorRandom() * pebblePalette.length)]);
    pebbles.setColorAt(pebbleIndex, pebbleColor);
  }
  pebbles.castShadow = true; pebbles.receiveShadow = true;
  scene.add(pebbles);
  const rockMaterial = enrichStoneMaterial(createMaterial('rock', 62, 1, 1)); rockMaterial.vertexColors = true; rockMaterial.bumpScale = .035;
  const mossMaterial = createMaterial('moss', 64, 3, 3);
  mergeStaticMeshes(scene, sand);
  scene.add(temple);
  return { scene, sand, sunlight, hemisphere, fillLight, rockMaterial, mossMaterial, temple, forest };
}

export function createStone(definition, rockMaterial, mossMaterial) {
  const group = new THREE.Group();
  group.userData.definition = { ...definition };
  const randomNumber = seededRandom(definition.seed);
  const shapeScales = { spire: [.65, 1.48, .6], reclining: [1.17, .54, .61], mountain: [.99, 1.05, .77], split: [.75, 1.12, .66] };
  const shapeScale = shapeScales[definition.shape];
  let geometry = new THREE.IcosahedronGeometry(1, 4);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  const noiseOffset = randomNumber() * 20;
  for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {
    const sourceX = positions.getX(vertexIndex), sourceY = positions.getY(vertexIndex), sourceZ = positions.getZ(vertexIndex);
    const broadNoise = Math.sin(sourceX * 3.1 + sourceY * 2.8 + noiseOffset) * Math.cos(sourceZ * 4.7 - sourceY * 2.2) * .16;
    const fineNoise = Math.sin(sourceX * 17 + sourceZ * 11 + noiseOffset) * Math.sin(sourceY * 13 - sourceZ * 8) * .038;
    const radius = 1 + broadNoise + fineNoise;
    let height = (sourceY + .8) * shapeScale[1] * .55;
    if (definition.shape === 'split') height *= .48 + .6 * Math.abs(sourceX);
    const worldY = Math.max(-.09, height * radius);
    positions.setXYZ(vertexIndex, sourceX * shapeScale[0] * radius + sourceY * .13, worldY, sourceZ * shapeScale[2] * radius);
    const shade = .76 + broadNoise * .9 + fineNoise * 1.5;
    const mossAmount = sourceY < -.2 ? .035 : 0;
    color.setRGB(shade * .97, shade + mossAmount, shade * .99); color.toArray(colors, vertexIndex * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.deleteAttribute('normal'); geometry = mergeVertices(geometry); geometry.computeVertexNormals();
  geometry.setAttribute('stoneSeed', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(noiseOffset), 1));
  const stone = new THREE.Mesh(geometry, rockMaterial); stone.castShadow = true; stone.receiveShadow = true; group.add(stone);
  const mossGeometry = new THREE.SphereGeometry(1, 64, 24);
  const mossPositions = mossGeometry.attributes.position;
  for (let vertexIndex = 0; vertexIndex < mossPositions.count; vertexIndex++) {
    const sourceX = mossPositions.getX(vertexIndex), sourceY = mossPositions.getY(vertexIndex), sourceZ = mossPositions.getZ(vertexIndex);
    const edgeDistortion = 1 + Math.sin(sourceX * 7 + sourceZ * 5 + noiseOffset) * .07 + Math.cos(sourceZ * 13 + noiseOffset) * .025;
    const cushionVariation = 1 + Math.sin(sourceX * 8 + noiseOffset) * Math.cos(sourceZ * 7) * .16;
    const moundHeight = sourceY > 0 ? .24 * Math.pow(sourceY, 1.3) * cushionVariation : sourceY * .04;
    mossPositions.setXYZ(vertexIndex, sourceX * shapeScale[0] * 1.4 * edgeDistortion, moundHeight - .008, sourceZ * shapeScale[2] * 1.46 * edgeDistortion);
  }
  mossGeometry.computeVertexNormals();
  const moss = new THREE.Mesh(mossGeometry, mossMaterial); moss.castShadow = true; moss.receiveShadow = true; group.add(moss);
  group.scale.setScalar(definition.size); group.rotation.y = definition.rotation;
  group.position.set(definition.positionX, 0, definition.positionZ);
  return group;
}
