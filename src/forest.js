import * as THREE from 'three';

// Overlapping evergreen understory closes the horizon; distinct crown shapes
// and leaf sprays keep the taller layers readable above it.
export function createForest(scene, createLeafTexture, randomNumber) {
  const transform = new THREE.Object3D();
  const foliageColor = new THREE.Color();
  const leafGeometry = new THREE.PlaneGeometry(1, 1);
  const foliageBatches = new Map();
  const canopyCores = [];
  const barkMaterial = new THREE.MeshStandardMaterial({ color: '#555343', roughness: 1 });
  const trunkGeometry = new THREE.CylinderGeometry(.45, 1, 1, 7);
  const branchDirection = new THREE.Vector3();
  const verticalDirection = new THREE.Vector3(0, 1, 0);

  for (const species of ['broadleaf', 'maple', 'conifer']) {
    const material = new THREE.MeshStandardMaterial({ map: createLeafTexture(species), alphaTest: .45, side: THREE.DoubleSide, roughness: 1 });
    foliageBatches.set(species, { material, instances: [] });
  }

  function branch(startPosition, endPosition, radius) {
    branchDirection.subVectors(endPosition, startPosition);
    const mesh = new THREE.Mesh(trunkGeometry.clone(), barkMaterial);
    mesh.position.copy(startPosition).add(endPosition).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(verticalDirection, branchDirection.clone().normalize());
    mesh.scale.set(radius, branchDirection.length(), radius);
    mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }

  function crown(species, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, sprayCount, hue, lightness) {
    // Dark, opaque inner foliage prevents pale sky from showing through every
    // leaf card. Its small irregular lobes are buried under the outer sprays.
    for (let lobeIndex = 0; lobeIndex < 3; lobeIndex++) {
      const lobeAngle = lobeIndex * Math.PI * 2 / 3 + randomNumber();
      canopyCores.push({
        position: [centerX + Math.cos(lobeAngle) * radiusX * .25, centerY + (randomNumber() - .5) * radiusY * .3, centerZ + Math.sin(lobeAngle) * radiusZ * .25],
        scale: [radiusX * .61, radiusY * .72, radiusZ * .61], hue, lightness: lightness * .57,
      });
    }
    const instances = foliageBatches.get(species).instances;
    for (let sprayIndex = 0; sprayIndex < sprayCount; sprayIndex++) {
      const azimuth = randomNumber() * Math.PI * 2;
      const elevation = randomNumber() * 2 - 1;
      const radialFactor = .72 + randomNumber() * .32;
      const horizontalFactor = Math.sqrt(1 - elevation * elevation) * radialFactor;
      const spraySize = (species === 'conifer' ? .8 : .62) + randomNumber() * .52;
      transform.position.set(centerX + Math.cos(azimuth) * horizontalFactor * radiusX, centerY + elevation * radialFactor * radiusY, centerZ + Math.sin(azimuth) * horizontalFactor * radiusZ);
      transform.rotation.set((randomNumber() - .5) * 1.8, randomNumber() * Math.PI * 2, (randomNumber() - .5) * 1.3);
      transform.scale.set(spraySize * 1.25, spraySize, 1); transform.updateMatrix();
      foliageColor.setHSL(hue + (randomNumber() - .5) * .025, species === 'maple' ? .34 : .25, lightness + (randomNumber() - .5) * .12);
      instances.push({ matrix: transform.matrix.clone(), color: foliageColor.clone() });
    }
  }

  // Two staggered bands begin below wall level. They overlap in both width
  // and height, including along the courtyard's side walls.
  for (let bandIndex = 0; bandIndex < 2; bandIndex++) {
    for (let shrubIndex = 0; shrubIndex < 36; shrubIndex++) {
      const centerX = -37 + shrubIndex * 2.15 + (randomNumber() - .5) * .7;
      const centerZ = -9.6 - bandIndex * 3.7 - randomNumber() * 1.1;
      const shrubHeight = 2.5 + randomNumber() * 1.4 + bandIndex * .4;
      crown('broadleaf', centerX, shrubHeight * .47, centerZ, 1.6 + randomNumber() * .7, shrubHeight * .68, 1.6, 75, .255, .30 - bandIndex * .025);
    }
  }
  for (const side of [-1, 1]) {
    for (let shrubIndex = 0; shrubIndex < 9; shrubIndex++) {
      crown('broadleaf', side * (15.3 + randomNumber() * .6), 1.65, -7 + shrubIndex * 1.9, 1.9, 1.85 + randomNumber() * .5, 1.75, 65, .255, .30);
    }
  }

  // Spreading maples: leaning trunks and separated, broad, shallow crowns.
  for (let treeIndex = 0; treeIndex < 16; treeIndex++) {
    const trunkX = -35 + treeIndex * 4.6 + (randomNumber() - .5) * 1.7;
    const trunkZ = -14.5 - randomNumber() * 4;
    const treeHeight = 5.0 + randomNumber() * 2.5;
    const trunkLean = (randomNumber() - .5) * 1.3;
    const junction = new THREE.Vector3(trunkX + trunkLean, treeHeight * .64, trunkZ);
    branch(new THREE.Vector3(trunkX, -.7, trunkZ), junction, .20);
    const hue = treeIndex % 5 === 2 ? .105 : .235;
    for (let branchIndex = 0; branchIndex < 4; branchIndex++) {
      const azimuth = branchIndex * 2.4 + treeIndex;
      const reach = 1.2 + randomNumber() * 1.4;
      const crownCenter = new THREE.Vector3(junction.x + Math.cos(azimuth) * reach, treeHeight - .6 + randomNumber() * 1.4, trunkZ + Math.sin(azimuth) * reach);
      branch(junction, crownCenter, .065);
      crown('maple', crownCenter.x, crownCenter.y, crownCenter.z, 2.2 + randomNumber() * .6, .85 + randomNumber() * .3, 1.8, 80, hue, .35);
    }
  }

  // Pines: irregular horizontal pads on exposed, bent branches.
  for (let treeIndex = 0; treeIndex < 10; treeIndex++) {
    const trunkX = -34 + treeIndex * 7.4 + randomNumber() * 1.6;
    const trunkZ = -21 - randomNumber() * 4;
    const treeHeight = 7.8 + randomNumber() * 3;
    const junction = new THREE.Vector3(trunkX + .7, treeHeight * .60, trunkZ);
    branch(new THREE.Vector3(trunkX, -.7, trunkZ), junction, .25);
    for (let tierIndex = 0; tierIndex < 4; tierIndex++) {
      const azimuth = tierIndex * 2.8 + treeIndex;
      const reach = 2.5 - tierIndex * .35;
      const crownCenter = new THREE.Vector3(junction.x + Math.cos(azimuth) * reach, treeHeight * .62 + tierIndex * .9, trunkZ + Math.sin(azimuth) * reach);
      branch(junction, crownCenter, .075);
      crown('conifer', crownCenter.x, crownCenter.y, crownCenter.z, 2.5 - tierIndex * .28, .65, 1.65, 65, .30, .27);
    }
  }

  // Rear cedars: tall tapering silhouettes in overlapping, cooler green tiers.
  for (let treeIndex = 0; treeIndex < 27; treeIndex++) {
    const trunkX = -43 + treeIndex * 3.35 + (randomNumber() - .5) * 1.4;
    const trunkZ = -29 - randomNumber() * 7;
    const treeHeight = 10 + randomNumber() * 6;
    branch(new THREE.Vector3(trunkX, -.7, trunkZ), new THREE.Vector3(trunkX, treeHeight, trunkZ), .24);
    for (let tierIndex = 0; tierIndex < 6; tierIndex++) {
      const tierFraction = tierIndex / 5;
      const crownRadius = 2.65 * (1 - tierFraction * .82);
      crown('conifer', trunkX, treeHeight * (.32 + tierFraction * .65), trunkZ, crownRadius, 1.15 - tierFraction * .45, crownRadius, 42, .31, .265);
    }
  }

  const coreGeometry = new THREE.IcosahedronGeometry(1, 2);
  const corePositions = coreGeometry.attributes.position;
  for (let vertexIndex = 0; vertexIndex < corePositions.count; vertexIndex++) {
    const positionX = corePositions.getX(vertexIndex), positionY = corePositions.getY(vertexIndex), positionZ = corePositions.getZ(vertexIndex);
    const surfaceFactor = 1 + Math.sin(positionX * 9 + positionZ * 5) * Math.cos(positionY * 11) * .1;
    corePositions.setXYZ(vertexIndex, positionX * surfaceFactor, positionY * surfaceFactor, positionZ * surfaceFactor);
  }
  const coreTexture = createLeafTexture('canopy');
  coreTexture.wrapS = coreTexture.wrapT = THREE.RepeatWrapping;
  coreTexture.repeat.set(4, 3); coreTexture.anisotropy = 8;
  const coreMaterial = new THREE.MeshStandardMaterial({ map: coreTexture, bumpMap: coreTexture, bumpScale: .16, roughness: 1 });
  const cores = new THREE.InstancedMesh(coreGeometry, coreMaterial, canopyCores.length);
  cores.name = 'Dense forest understory and inner crowns';
  for (let coreIndex = 0; coreIndex < canopyCores.length; coreIndex++) {
    const core = canopyCores[coreIndex];
    transform.position.fromArray(core.position); transform.scale.fromArray(core.scale); transform.rotation.set(0, coreIndex * 2.4, 0); transform.updateMatrix();
    cores.setMatrixAt(coreIndex, transform.matrix);
    foliageColor.setHSL(core.hue, .27, core.lightness); cores.setColorAt(coreIndex, foliageColor);
  }
  cores.castShadow = true; cores.receiveShadow = true; scene.add(cores);
  for (const [species, batch] of foliageBatches) {
    const foliage = new THREE.InstancedMesh(leafGeometry, batch.material, batch.instances.length);
    foliage.name = `${species} foliage`;
    for (let instanceIndex = 0; instanceIndex < batch.instances.length; instanceIndex++) {
      foliage.setMatrixAt(instanceIndex, batch.instances[instanceIndex].matrix);
      foliage.setColorAt(instanceIndex, batch.instances[instanceIndex].color);
    }
    foliage.castShadow = true; foliage.receiveShadow = true; scene.add(foliage);
  }
  trunkGeometry.dispose();
}
