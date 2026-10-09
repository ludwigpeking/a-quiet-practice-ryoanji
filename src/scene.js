import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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
  const baseColors = { sand: '#dfddd0', wood: '#51402c', wall: '#aa9471', rock: '#777974', moss: '#667443' };
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
    context.fillStyle = randomNumber() > .5 ? 'rgba(255,248,219,.10)' : 'rgba(20,30,19,.12)';
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

function createLeafTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const randomNumber = seededRandom(78);
  context.strokeStyle = '#819174'; context.lineWidth = 1.7;
  context.beginPath(); context.moveTo(64, 124); context.bezierCurveTo(49, 76, 84, 47, 63, 7); context.stroke();
  for (let leafIndex = 0; leafIndex < 27; leafIndex++) {
    const centerX = 20 + randomNumber() * 88;
    const centerY = 8 + randomNumber() * 104;
    const leafLength = 7 + randomNumber() * 11;
    context.save(); context.translate(centerX, centerY); context.rotate(randomNumber() * Math.PI * 2);
    const gradient = context.createLinearGradient(-leafLength, 0, leafLength, 0);
    gradient.addColorStop(0, '#9aab88'); gradient.addColorStop(.5, '#d0d8ba'); gradient.addColorStop(1, '#829571');
    context.fillStyle = gradient; context.beginPath(); context.moveTo(-leafLength, 0); context.quadraticCurveTo(0, -leafLength * .7, leafLength, 0); context.quadraticCurveTo(0, leafLength * .7, -leafLength, 0); context.fill(); context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export const originalStones = [
  { positionX: -8.3, positionZ: .8, shape: 'mountain', size: 1.3, rotation: .2, seed: 21 },
  { positionX: -9.45, positionZ: 1.1, shape: 'reclining', size: .68, rotation: -.5, seed: 22 },
  { positionX: -7.2, positionZ: 1.4, shape: 'spire', size: .63, rotation: .8, seed: 23 },
  { positionX: -8.5, positionZ: 2.0, shape: 'reclining', size: .48, rotation: 1.1, seed: 24 },
  { positionX: -9.4, positionZ: .05, shape: 'mountain', size: .48, rotation: 0, seed: 25 },
  { positionX: -4.1, positionZ: -2.4, shape: 'spire', size: .95, rotation: -.4, seed: 31 },
  { positionX: -3.05, positionZ: -2.15, shape: 'reclining', size: .61, rotation: .5, seed: 32 },
  { positionX: .1, positionZ: .0, shape: 'mountain', size: .91, rotation: 1.1, seed: 41 },
  { positionX: -1.05, positionZ: .5, shape: 'reclining', size: .71, rotation: .2, seed: 42 },
  { positionX: .9, positionZ: .55, shape: 'spire', size: .52, rotation: -.8, seed: 43 },
  { positionX: 4.1, positionZ: -2.8, shape: 'reclining', size: .91, rotation: -.3, seed: 51 },
  { positionX: 5.05, positionZ: -2.9, shape: 'spire', size: .68, rotation: .8, seed: 52 },
  { positionX: 7.25, positionZ: 1.6, shape: 'split', size: 1.02, rotation: .5, seed: 61 },
  { positionX: 8.2, positionZ: 2.2, shape: 'reclining', size: .65, rotation: -.4, seed: 62 },
  { positionX: 6.25, positionZ: 2.1, shape: 'mountain', size: .48, rotation: 0, seed: 63 },
];

export function createGardenScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c7cfbd');
  scene.fog = new THREE.Fog('#c7cfbd', 34, 85);
  const hemisphere = new THREE.HemisphereLight('#e4eadb', '#8b765a', 1.6); scene.add(hemisphere);
  const sunlight = new THREE.DirectionalLight('#ffe9c8', 2.6);
  sunlight.position.set(-9, 15, 8); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048); sunlight.shadow.camera.left = -18; sunlight.shadow.camera.right = 18; sunlight.shadow.camera.top = 16; sunlight.shadow.camera.bottom = -16;
  sunlight.shadow.camera.near = .1; sunlight.shadow.camera.far = 65; sunlight.shadow.normalBias = .035; sunlight.shadow.bias = -.00015; sunlight.shadow.radius = 4;
  scene.add(sunlight);
  const fillLight = new THREE.DirectionalLight('#bfd1ce', .65); fillLight.position.set(12, 8, -8); scene.add(fillLight);
  const woodMaterial = createMaterial('wood', 45, 1, 3);
  const wallMaterial = createMaterial('wall', 52, 5, 1);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#4d5149', roughness: .92 });
  const foundationMaterial = new THREE.MeshStandardMaterial({ color: '#79796b', roughness: 1 });
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
  const borderMaterial = new THREE.MeshStandardMaterial({ color: '#a4a493', roughness: 1 });
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
  for (const postX of [-13.3, -5.6, 5.6, 13.3]) {
    box(temple, .23, 4.2, .29, postX, 2.15, 6.1, woodMaterial);
    box(temple, .38, .15, .4, postX, .32, 6.1, woodMaterial);
  }
  box(temple, 33, .32, .45, 0, 4.13, 6.1, woodMaterial);
  box(temple, 33, .2, 6.7, 0, 4.45, 9.3, woodMaterial);
  for (let rafterIndex = 0; rafterIndex < 57; rafterIndex++) box(temple, .11, .22, 7.5, -16 + rafterIndex * .58, 4.25, 9.05, woodMaterial);
  box(temple, 33, .17, .3, 0, 4.31, 5.37, woodMaterial);
  const screenMaterial = new THREE.MeshStandardMaterial({ color: '#c5baa0', roughness: 1 });
  box(temple, 33, 4.3, .16, 0, 2.2, 11.9, screenMaterial);
  for (let panelIndex = 0; panelIndex < 60; panelIndex++) box(temple, .055, 4.3, .1, -16 + panelIndex * .55, 2.2, 11.77, woodMaterial);
  for (let railIndex = 0; railIndex < 9; railIndex++) box(temple, 33, .04, .1, 0, railIndex * .48 + .35, 11.77, woodMaterial);
  // Fine leaf clusters use a single instanced draw call, with layered canopy depth.
  const randomNumber = seededRandom(500);
  mergeStaticMeshes(temple);
  scene.remove(temple);
  const foliageGeometry = new THREE.PlaneGeometry(1, 1);
  const foliageMaterial = new THREE.MeshStandardMaterial({ map: createLeafTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: 1, color: '#ffffff' });
  const leafCount = 12500;
  const foliage = new THREE.InstancedMesh(foliageGeometry, foliageMaterial, leafCount);
  foliage.castShadow = true; foliage.receiveShadow = true;
  const transform = new THREE.Object3D(); const leafColor = new THREE.Color();
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#5a5741', roughness: 1 });
  let leafIndex = 0;
  for (let treeIndex = 0; treeIndex < 50; treeIndex++) {
    const trunkX = (randomNumber() - .5) * 76;
    const trunkZ = -10 - randomNumber() * 24;
    const treeHeight = 3.4 + randomNumber() * 7;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .28, treeHeight, 7), trunkMaterial);
    trunk.position.set(trunkX, treeHeight / 2 - .5, trunkZ); trunk.castShadow = true; scene.add(trunk);
    const canopyRadius = 2.5 + randomNumber() * 2.5;
    for (let branchIndex = 0; branchIndex < 5; branchIndex++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(.025, .09, 2.5, 5), trunkMaterial);
      branch.position.set(trunkX + Math.sin(branchIndex * 2) * .7, treeHeight * .7 + branchIndex * .3, trunkZ + Math.cos(branchIndex * 2) * .7);
      branch.rotation.z = Math.sin(branchIndex * 2) * .8; branch.rotation.x = Math.cos(branchIndex * 2) * .8; scene.add(branch);
    }
    for (let clusterIndex = 0; clusterIndex < 250; clusterIndex++) {
      const azimuth = randomNumber() * Math.PI * 2;
      const verticalDirection = randomNumber() * 2 - 1;
      const radialDistance = Math.cbrt(randomNumber()) * canopyRadius;
      const horizontalRadius = Math.sqrt(1 - verticalDirection * verticalDirection) * radialDistance;
      transform.position.set(trunkX + Math.cos(azimuth) * horizontalRadius, treeHeight - 1 + verticalDirection * radialDistance * .65, trunkZ + Math.sin(azimuth) * horizontalRadius);
      const leafScale = .55 + randomNumber() * .6;
      transform.scale.set(leafScale * 1.4, leafScale, leafScale);
      transform.rotation.set(randomNumber(), randomNumber() * 6, randomNumber()); transform.updateMatrix();
      foliage.setMatrixAt(leafIndex, transform.matrix);
      const isAmberTree = treeIndex % 11 === 0;
      leafColor.setHSL(isAmberTree ? .095 : .24 + randomNumber() * .045, isAmberTree ? .38 : .18 + randomNumber() * .15, .24 + randomNumber() * .21);
      foliage.setColorAt(leafIndex++, leafColor);
    }
  }
  scene.add(foliage);
  const pebbleGeometry = new THREE.IcosahedronGeometry(1, 0);
  const pebbles = new THREE.InstancedMesh(pebbleGeometry, borderMaterial, 1600);
  for (let pebbleIndex = 0; pebbleIndex < 1600; pebbleIndex++) {
    const isSide = pebbleIndex % 2 === 0;
    const side = randomNumber() > .5 ? 1 : -1;
    transform.position.set(isSide ? side * (12.05 + randomNumber() * .32) : (randomNumber() - .5) * 24, -.01, isSide ? (randomNumber() - .5) * 11.7 : side * (6 + randomNumber() * .2));
    transform.scale.set(.04 + randomNumber() * .065, .03 + randomNumber() * .04, .04 + randomNumber() * .065); transform.rotation.set(randomNumber() * 3, randomNumber() * 3, 0); transform.updateMatrix(); pebbles.setMatrixAt(pebbleIndex, transform.matrix);
  }
  scene.add(pebbles);
  const rockMaterial = createMaterial('rock', 62, 1, 1); rockMaterial.vertexColors = true; rockMaterial.bumpScale = .16;
  const mossMaterial = createMaterial('moss', 64, 3, 3);
  mergeStaticMeshes(scene, sand);
  scene.add(temple);
  return { scene, sand, sunlight, hemisphere, fillLight, rockMaterial, mossMaterial, temple };
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
  const stone = new THREE.Mesh(geometry, rockMaterial); stone.castShadow = true; stone.receiveShadow = true; group.add(stone);
  const mossGeometry = new THREE.SphereGeometry(1, 48, 12);
  const mossPositions = mossGeometry.attributes.position;
  for (let vertexIndex = 0; vertexIndex < mossPositions.count; vertexIndex++) {
    const sourceX = mossPositions.getX(vertexIndex), sourceZ = mossPositions.getZ(vertexIndex);
    const edgeDistortion = 1 + Math.sin(sourceX * 13 + sourceZ * 9 + noiseOffset) * .08 + Math.cos(sourceZ * 17) * .04;
    mossPositions.setXYZ(vertexIndex, sourceX * shapeScale[0] * 1.44 * edgeDistortion, mossPositions.getY(vertexIndex) * .095 - .008, sourceZ * shapeScale[2] * 1.53 * edgeDistortion);
  }
  mossGeometry.computeVertexNormals();
  const moss = new THREE.Mesh(mossGeometry, mossMaterial); moss.receiveShadow = true; group.add(moss);
  group.scale.setScalar(definition.size); group.rotation.y = definition.rotation;
  group.position.set(definition.positionX, 0, definition.positionZ);
  return group;
}
