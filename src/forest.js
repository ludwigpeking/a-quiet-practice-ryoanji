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

  function crown(species, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, sprayCount, hue, lightness, autumnHue = .06) {
    // Dark, opaque inner foliage prevents pale sky from showing through every
    // leaf card. Its small irregular lobes are buried under the outer sprays.
    for (let lobeIndex = 0; lobeIndex < 3; lobeIndex++) {
      const lobeAngle = lobeIndex * Math.PI * 2 / 3 + randomNumber();
      canopyCores.push({
        position: [centerX + Math.cos(lobeAngle) * radiusX * .25, centerY + (randomNumber() - .5) * radiusY * .3, centerZ + Math.sin(lobeAngle) * radiusZ * .25],
        scale: [radiusX * .61, radiusY * .72, radiusZ * .61], species, hue, autumnHue, lightness: lightness * .57,
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
      instances.push({ matrix: transform.matrix.clone(), species, hue: hue + (randomNumber() - .5) * .018, autumnHue: autumnHue + (randomNumber() - .5) * .014, lightness: lightness + (randomNumber() - .5) * .09 });
    }
  }

  // Two staggered bands begin below wall level. They overlap in both width
  // and height, including along the courtyard's side walls.
  for (let bandIndex = 0; bandIndex < 2; bandIndex++) {
    for (let shrubIndex = 0; shrubIndex < 36; shrubIndex++) {
      const centerX = -37 + shrubIndex * 2.15 + (randomNumber() - .5) * .7;
      const centerZ = -9.6 - bandIndex * 3.7 - randomNumber() * 1.1;
      const shrubHeight = 2.5 + randomNumber() * 1.4 + bandIndex * .4;
      crown('broadleaf', centerX, shrubHeight * .47, centerZ, 2 + randomNumber() * .8, shrubHeight * .72, 1.9, 85, .22 + randomNumber() * .095, .27 + randomNumber() * .075 - bandIndex * .025);
    }
  }
  for (const side of [-1, 1]) {
    for (let shrubIndex = 0; shrubIndex < 9; shrubIndex++) {
      crown('broadleaf', side * (15.3 + randomNumber() * .6), 1.65, -7 + shrubIndex * 1.9, 1.9, 1.85 + randomNumber() * .5, 1.75, 65, .255, .30);
    }
  }

  // Spreading maples: leaning trunks and separated, broad, shallow crowns.
  for (let treeIndex = 0; treeIndex < 11; treeIndex++) {
    const trunkX = -35 + treeIndex * 7 + (randomNumber() - .5) * 2.3;
    const trunkZ = -14.5 - randomNumber() * 4;
    const treeHeight = 5.6 + randomNumber() * 3.4;
    const trunkLean = (randomNumber() - .5) * 1.3;
    const junction = new THREE.Vector3(trunkX + trunkLean, treeHeight * .64, trunkZ);
    branch(new THREE.Vector3(trunkX, -.7, trunkZ), junction, .20);
    const hue = .20 + randomNumber() * .11;
    const treeLightness = .32 + randomNumber() * .09;
    const autumnHue = [.005, .035, .075, .12][treeIndex % 4];
    for (let branchIndex = 0; branchIndex < 4; branchIndex++) {
      const azimuth = branchIndex * 2.4 + treeIndex;
      const reach = 1.8 + randomNumber() * 1.7;
      const crownCenter = new THREE.Vector3(junction.x + Math.cos(azimuth) * reach, treeHeight - .6 + randomNumber() * 1.4, trunkZ + Math.sin(azimuth) * reach);
      branch(junction, crownCenter, .065);
      crown('maple', crownCenter.x, crownCenter.y, crownCenter.z, 3.1 + randomNumber() * 1.1, 1.55 + randomNumber() * .7, 2.8, 160, hue, treeLightness, autumnHue);
    }
  }

  // Pines: irregular horizontal pads on exposed, bent branches.
  for (let treeIndex = 0; treeIndex < 10; treeIndex++) {
    const trunkX = -34 + treeIndex * 7.4 + randomNumber() * 1.6;
    const trunkZ = -21 - randomNumber() * 4;
    const treeHeight = 12 + randomNumber() * 5;
    const treeHue = .28 + randomNumber() * .09;
    const treeLightness = .25 + randomNumber() * .075;
    const junction = new THREE.Vector3(trunkX + .7, treeHeight * .60, trunkZ);
    branch(new THREE.Vector3(trunkX, -.7, trunkZ), junction, .25);
    for (let tierIndex = 0; tierIndex < 4; tierIndex++) {
      const azimuth = tierIndex * 2.8 + treeIndex;
      const reach = 3.4 - tierIndex * .4;
      const crownCenter = new THREE.Vector3(junction.x + Math.cos(azimuth) * reach, treeHeight * .60 + tierIndex * 1.5, trunkZ + Math.sin(azimuth) * reach);
      branch(junction, crownCenter, .075);
      crown('conifer', crownCenter.x, crownCenter.y, crownCenter.z, 3.3 - tierIndex * .3, 1.15, 2.4, 110, treeHue, treeLightness);
    }
  }

  // Rear cedars: tall tapering silhouettes in overlapping, cooler green tiers.
  for (let treeIndex = 0; treeIndex < 20; treeIndex++) {
    const trunkX = -43 + treeIndex * 4.6 + (randomNumber() - .5) * 1.4;
    const trunkZ = -29 - randomNumber() * 7;
    const treeHeight = 18 + randomNumber() * 8;
    const treeHue = .28 + randomNumber() * .095;
    const treeLightness = .23 + randomNumber() * .08;
    branch(new THREE.Vector3(trunkX, -.7, trunkZ), new THREE.Vector3(trunkX, treeHeight, trunkZ), .24);
    for (let tierIndex = 0; tierIndex < 8; tierIndex++) {
      const tierFraction = tierIndex / 7;
      const crownRadius = 3.7 * (1 - tierFraction * .85);
      crown('conifer', trunkX, treeHeight * (.25 + tierFraction * .73), trunkZ, crownRadius, 2.2 - tierFraction * 1.05, crownRadius, 70, treeHue, treeLightness);
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
    core.matrix = transform.matrix.clone();
    foliageColor.setHSL(core.hue, .27, core.lightness); cores.setColorAt(coreIndex, foliageColor);
  }
  cores.castShadow = true; cores.receiveShadow = true; scene.add(cores);
  for (const [species, batch] of foliageBatches) {
    const foliage = new THREE.InstancedMesh(leafGeometry, batch.material, batch.instances.length);
    foliage.name = `${species} foliage`;
    for (let instanceIndex = 0; instanceIndex < batch.instances.length; instanceIndex++) {
      foliage.setMatrixAt(instanceIndex, batch.instances[instanceIndex].matrix);
      foliageColor.setHSL(batch.instances[instanceIndex].hue, .38, batch.instances[instanceIndex].lightness);
      foliage.setColorAt(instanceIndex, foliageColor);
    }
    foliage.castShadow = true; foliage.receiveShadow = true; scene.add(foliage);
    batch.mesh = foliage;
  }
  trunkGeometry.dispose();
  function seasonalColor(instance, season, isCore) {
    let hue = instance.hue;
    let saturation = instance.species === 'maple' ? .48 : .32;
    let lightness = instance.lightness;
    if (instance.species === 'maple') {
      if (season === 'autumn') { hue = instance.autumnHue; saturation = .78; lightness *= 1.12; }
      if (season === 'spring') { hue -= .035; saturation = .55; lightness *= 1.16; }
    } else {
      if (season === 'spring') { hue -= .012; lightness *= 1.07; }
      if (season === 'winter') { saturation *= .74; lightness *= .90; }
    }
    foliageColor.setHSL(hue, saturation, lightness * (isCore ? 1.15 : 1));
    return foliageColor;
  }
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  function setSeason(season) {
    for (let coreIndex = 0; coreIndex < canopyCores.length; coreIndex++) {
      const core = canopyCores[coreIndex];
      cores.setColorAt(coreIndex, seasonalColor(core, season, true));
      cores.setMatrixAt(coreIndex, season === 'winter' && core.species === 'maple' ? hiddenMatrix : core.matrix);
    }
    cores.instanceColor.needsUpdate = true; cores.instanceMatrix.needsUpdate = true;
    for (const [species, batch] of foliageBatches) {
      batch.mesh.visible = !(season === 'winter' && species === 'maple');
      for (let instanceIndex = 0; instanceIndex < batch.instances.length; instanceIndex++) batch.mesh.setColorAt(instanceIndex, seasonalColor(batch.instances[instanceIndex], season, false));
      batch.mesh.instanceColor.needsUpdate = true;
    }
  }
  setSeason('summer');
  return { setSeason };
}
