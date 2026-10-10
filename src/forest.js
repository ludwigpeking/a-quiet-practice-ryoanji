import * as THREE from 'three';
import { forestPalettes, isDeciduousFamily, seasonalLeafRetention } from './forest-palette.js';
import { createTreeBranches } from './tree-branches.js';
import { createForestBreeze } from './breeze.js';

// Overlapping evergreen understory closes the horizon; distinct crown shapes
// and leaf sprays keep the taller layers readable above it.
export function createForest(scene, createLeafTexture, randomNumber) {
  const transform = new THREE.Object3D();
  const foliageColor = new THREE.Color();
  const leafGeometry = new THREE.PlaneGeometry(1, 1);
  const foliageBatches = new Map();
  const canopyCores = [];
  const treeBranches = createTreeBranches(scene);
  const breeze = createForestBreeze();
  breeze.applyToMaterial(treeBranches.material);
  const branch = treeBranches.branch;

  for (const species of ['broadleaf', 'maple', 'conifer', 'cherry']) {
    const material = new THREE.MeshStandardMaterial({ map: createLeafTexture(species), alphaTest: .45, side: THREE.DoubleSide, roughness: 1 });
    breeze.applyToMaterial(material, species === 'conifer' ? .005 : .014);
    foliageBatches.set(species, { material, instances: [] });
  }
  const cherryBlossomTexture = foliageBatches.get('cherry').material.map;
  const cherryLeafTexture = createLeafTexture('broadleaf');

  function crown(species, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, sprayCount, hue, lightness, autumnHue = .06, seasonalFamily = species === 'conifer' ? 'cedar' : species) {
    // Dark, opaque inner foliage prevents pale sky from showing through every
    // leaf card. Its small irregular lobes are buried under the outer sprays.
    for (let lobeIndex = 0; lobeIndex < 3; lobeIndex++) {
      const lobeAngle = lobeIndex * Math.PI * 2 / 3 + randomNumber();
      canopyCores.push({
        position: [centerX + Math.cos(lobeAngle) * radiusX * .25, centerY + (randomNumber() - .5) * radiusY * .3, centerZ + Math.sin(lobeAngle) * radiusZ * .25],
        scale: [radiusX * .35, radiusY * .42, radiusZ * .35], species, seasonalFamily, hue, autumnHue, lightness: lightness * .57,
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
      instances.push({ matrix: transform.matrix.clone(), species, seasonalFamily, retentionRank: sprayIndex / sprayCount, hue: hue + (randomNumber() - .5) * .018, autumnHue: autumnHue + (randomNumber() - .5) * .014, lightness: lightness + (randomNumber() - .5) * .09 });
    }
  }

  // Two staggered bands begin below wall level. They overlap in both width
  // and height, including along the courtyard's side walls.
  for (let bandIndex = 0; bandIndex < 2; bandIndex++) {
    for (let shrubIndex = 0; shrubIndex < 36; shrubIndex++) {
      const centerX = -37 + shrubIndex * 2.15 + (randomNumber() - .5) * .7;
      const centerZ = -9.6 - bandIndex * 3.7 - randomNumber() * 1.1;
      const shrubHeight = 2.5 + randomNumber() * 1.4 + bandIndex * .4;
      const seasonalFamily = (shrubIndex + bandIndex * 2) % 5 < 2 ? 'understory' : 'broadleaf';
      crown('broadleaf', centerX, shrubHeight * .47, centerZ, 2 + randomNumber() * .8, shrubHeight * .72, 1.9, 85, .22 + randomNumber() * .095, .27 + randomNumber() * .075 - bandIndex * .025, .06, seasonalFamily);
      if (seasonalFamily === 'understory') {
        treeBranches.shrub(new THREE.Vector3(centerX, -.3, centerZ), shrubHeight);
      }
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
    const crownCenters = [];
    const hue = .20 + randomNumber() * .11;
    const treeLightness = .32 + randomNumber() * .09;
    const autumnHue = [.005, .035, .075, .12][treeIndex % 4];
    const crownSpecies = treeIndex === 5 ? 'cherry' : 'maple';
    for (let branchIndex = 0; branchIndex < 4; branchIndex++) {
      const azimuth = branchIndex * 2.4 + treeIndex;
      const reach = 1.8 + randomNumber() * 1.7;
      const crownCenter = new THREE.Vector3(junction.x + Math.cos(azimuth) * reach, treeHeight - .6 + randomNumber() * 1.4, trunkZ + Math.sin(azimuth) * reach);
      crownCenters.push(crownCenter);
      crown(crownSpecies, crownCenter.x, crownCenter.y, crownCenter.z, 3.1 + randomNumber() * 1.1, 1.55 + randomNumber() * .7, 2.8, 160, hue, treeLightness, autumnHue);
    }
    treeBranches.deciduousTree(new THREE.Vector3(trunkX, -.7, trunkZ), crownCenters, .25 + treeIndex % 3 * .025, crownSpecies);
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
      crown('conifer', crownCenter.x, crownCenter.y, crownCenter.z, 3.3 - tierIndex * .3, 1.15, 2.4, 110, treeHue, treeLightness, .06, 'pine');
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

  // Return the grove along both outside walls. Broad, nearer crowns frame the
  // seated view; taller trees behind them keep the side horizon enclosed.
  for (const side of [-1, 1]) {
    for (let treeIndex = 0; treeIndex < 4; treeIndex++) {
      const trunkX = side * (16.6 + randomNumber() * 1.1);
      const trunkZ = -7.5 + treeIndex * 4.1;
      const treeHeight = 6.7 + randomNumber() * 2;
      const species = treeIndex % 2 === 0 ? 'maple' : 'broadleaf';
      const crownCenters = [];
      for (let limbIndex = 0; limbIndex < 3; limbIndex++) {
        const angle = limbIndex * 2.4 + treeIndex;
        const center = new THREE.Vector3(trunkX + Math.cos(angle) * 1.25, treeHeight + (randomNumber() - .5) * 1.2, trunkZ + Math.sin(angle) * 1.7);
        crownCenters.push(center);
        crown(species, center.x, center.y, center.z, 3.1, 2.1, 3.3, 135, .22 + randomNumber() * .08, .33, [.005, .07, .12, .035][treeIndex]);
      }
      treeBranches.deciduousTree(new THREE.Vector3(trunkX, -.7, trunkZ), crownCenters, .30, species);
      const cedarX = side * (22 + treeIndex % 2 * 1.7);
      const cedarHeight = 15 + randomNumber() * 5;
      branch(new THREE.Vector3(cedarX, -.7, trunkZ - 1), new THREE.Vector3(cedarX + side * .3, cedarHeight, trunkZ - 1), .27);
      for (let tierIndex = 0; tierIndex < 6; tierIndex++) {
        const tierFraction = tierIndex / 5;
        const radius = 3.9 * (1 - tierFraction * .82);
        crown('conifer', cedarX, cedarHeight * (.26 + tierFraction * .72), trunkZ - 1, radius, 2.3 - tierFraction, radius, 75, .30 + randomNumber() * .035, .27);
      }
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
  breeze.applyToMaterial(coreMaterial);
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
  function seasonalColor(instance, season, isCore) {
    const palette = forestPalettes[instance.seasonalFamily][season];
    let palettePosition = THREE.MathUtils.clamp((instance.hue - .20) / .17, 0, 1) * (palette.length - 1);
    if (instance.seasonalFamily === 'maple' && season === 'autumn') {
      palettePosition = THREE.MathUtils.clamp(instance.autumnHue / .12, 0, 1) * (palette.length - 1);
    }
    const paletteIndex = Math.floor(palettePosition);
    foliageColor.set(palette[paletteIndex]);
    foliageColor.lerp(new THREE.Color(palette[Math.min(paletteIndex + 1, palette.length - 1)]), palettePosition - paletteIndex);
    // Texture and shading supply most of the contrast; avoid painting black
    // cores and then shadowing them again. Color(hex) decodes sRGB to linear.
    const sourceLightness = isCore ? instance.lightness / .57 : instance.lightness;
    const brightnessFactor = THREE.MathUtils.clamp(sourceLightness / .33, .72, 1.35);
    const blossomBrightness = instance.seasonalFamily === 'cherry' && season === 'spring' ? .8 : 1;
    const seasonalBrightness = season === 'spring' ? 1.14 : season === 'summer' ? .86 : 1;
    foliageColor.multiplyScalar(brightnessFactor * (isCore ? 1.8 : 2.2) * blossomBrightness * seasonalBrightness);
    // Fresh spring leaves are lighter; mature summer greens stay deeper.
    // Apply the same seasonal treatment to the low, middle and high layers.
    const foliageLuminance = foliageColor.r * .2126 + foliageColor.g * .7152 + foliageColor.b * .0722;
    const retainedChroma = season === 'spring' ? .82 : season === 'summer' ? .76 : .52;
    foliageColor.setRGB(
      foliageLuminance + (foliageColor.r - foliageLuminance) * retainedChroma,
      foliageLuminance + (foliageColor.g - foliageLuminance) * retainedChroma,
      foliageLuminance + (foliageColor.b - foliageLuminance) * retainedChroma
    );
    return foliageColor;
  }
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  function setSeason(season) {
    for (let coreIndex = 0; coreIndex < canopyCores.length; coreIndex++) {
      const core = canopyCores[coreIndex];
      cores.setColorAt(coreIndex, seasonalColor(core, season, true));
      const hideCore = isDeciduousFamily(core.seasonalFamily) && (season === 'winter' || season === 'spring');
      cores.setMatrixAt(coreIndex, hideCore ? hiddenMatrix : core.matrix);
    }
    cores.instanceColor.needsUpdate = true; cores.instanceMatrix.needsUpdate = true;
    for (const [species, batch] of foliageBatches) {
      for (let instanceIndex = 0; instanceIndex < batch.instances.length; instanceIndex++) {
        const instance = batch.instances[instanceIndex];
        batch.mesh.setColorAt(instanceIndex, seasonalColor(instance, season, false));
        batch.mesh.setMatrixAt(instanceIndex, instance.retentionRank < seasonalLeafRetention(instance.seasonalFamily, season) ? instance.matrix : hiddenMatrix);
      }
      batch.mesh.instanceColor.needsUpdate = true; batch.mesh.instanceMatrix.needsUpdate = true;
      if (species === 'cherry') { batch.material.map = season === 'spring' ? cherryBlossomTexture : cherryLeafTexture; batch.material.needsUpdate = true; }
    }
  }
  setSeason('summer');
  function inspectSeason() {
    const families = {};
    const instanceColor = new THREE.Color();
    const instanceMatrix = new THREE.Matrix4();
    for (const batch of foliageBatches.values()) {
      for (let instanceIndex = 0; instanceIndex < batch.instances.length; instanceIndex++) {
        const family = batch.instances[instanceIndex].seasonalFamily;
        if (!families[family]) families[family] = { color: [0, 0, 0], count: 0, visibleCount: 0 };
        const summary = families[family];
        batch.mesh.getColorAt(instanceIndex, instanceColor);
        summary.color[0] += instanceColor.r; summary.color[1] += instanceColor.g; summary.color[2] += instanceColor.b; summary.count++;
        batch.mesh.getMatrixAt(instanceIndex, instanceMatrix);
        if (instanceMatrix.elements[0] !== 0 || instanceMatrix.elements[1] !== 0 || instanceMatrix.elements[2] !== 0) summary.visibleCount++;
      }
    }
    for (const summary of Object.values(families)) summary.color = summary.color.map(function averageColor(channel) { return channel / summary.count; });
    return families;
  }
  return { setSeason, inspectSeason, breeze };
}
