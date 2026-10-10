import * as THREE from 'three';

function branchRandom(seed) {
  let currentSeed = seed >>> 0;
  return function randomNumber() {
    currentSeed = (currentSeed * 1664525 + 1013904223) >>> 0;
    return currentSeed / 4294967296;
  };
}

function createBarkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(canvas.width, canvas.height);
  const randomNumber = branchRandom(3107);
  for (let row = 0; row < canvas.height; row++) {
    for (let column = 0; column < canvas.width; column++) {
      const angle = column / canvas.width * Math.PI * 2;
      const grain = Math.sin(angle * 19 + Math.sin(row * .024) * .8);
      const fissure = Math.pow(Math.max(0, Math.cos(angle * 37 + Math.sin(row * .037 + angle * 3))), 12);
      const shade = 176 + grain * 16 - fissure * 48 + (randomNumber() - .5) * 25;
      const pixelIndex = (row * canvas.width + column) * 4;
      pixels.data[pixelIndex] = shade;
      pixels.data[pixelIndex + 1] = shade;
      pixels.data[pixelIndex + 2] = shade;
      pixels.data[pixelIndex + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

// Sweep a varying cross-section along a curved centerline. Every daughter limb
// starts on its parent's actual curve, rather than on an approximated chord.
export function createTaperedBranchGeometry(curve, baseRadius, tipRadius, seed, isTrunk = false) {
  const branchLength = curve.getLength();
  const lengthSegments = Math.max(5, Math.min(20, Math.ceil(branchLength * 3)));
  const radialSegments = baseRadius > .12 ? 10 : baseRadius > .035 ? 7 : 5;
  const frames = curve.computeFrenetFrames(lengthSegments, false);
  const positions = [], textureCoordinates = [], colors = [], indices = [];
  const position = new THREE.Vector3();
  for (let lengthIndex = 0; lengthIndex <= lengthSegments; lengthIndex++) {
    const lengthFraction = lengthIndex / lengthSegments;
    const center = curve.getPointAt(lengthFraction);
    const radius = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(lengthFraction, .8));
    const collarFactor = 1 + Math.exp(-lengthFraction * 20) * (isTrunk ? .32 : .15);
    for (let radialIndex = 0; radialIndex <= radialSegments; radialIndex++) {
      const angle = radialIndex / radialSegments * Math.PI * 2;
      const ridgeFactor = 1 + Math.sin(angle * 3 + seed) * .065 + Math.cos(angle * 5 - lengthFraction * 2) * .035;
      position.copy(center)
        .addScaledVector(frames.normals[lengthIndex], Math.cos(angle) * radius * collarFactor * ridgeFactor)
        .addScaledVector(frames.binormals[lengthIndex], Math.sin(angle) * radius * collarFactor * ridgeFactor);
      positions.push(position.x, position.y, position.z);
      textureCoordinates.push(radialIndex / radialSegments, lengthFraction * branchLength / .9);
      const brightness = .82 + Math.sin(angle * 3 + seed) * .10 + Math.sin(lengthFraction * 9 + seed) * .05;
      colors.push(brightness, brightness * .98, brightness * .94);
      if (lengthIndex < lengthSegments && radialIndex < radialSegments) {
        const firstVertex = lengthIndex * (radialSegments + 1) + radialIndex;
        const nextRingVertex = firstVertex + radialSegments + 1;
        indices.push(firstVertex, firstVertex + 1, nextRingVertex, firstVertex + 1, nextRingVertex + 1, nextRingVertex);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(textureCoordinates, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createTreeBranches(scene) {
  const barkTexture = createBarkTexture();
  const material = new THREE.MeshStandardMaterial({ color: '#756c60', map: barkTexture, bumpMap: barkTexture, bumpScale: .035, roughness: .96, vertexColors: true });
  const randomNumber = branchRandom(8349);

  function branch(startPosition, endPosition, baseRadius, tipRadius = baseRadius * .22, initialTangent = null, isTrunk = false) {
    const displacement = endPosition.clone().sub(startPosition);
    const branchLength = displacement.length();
    const lateralDirection = new THREE.Vector3(-displacement.z, 0, displacement.x).normalize();
    if (lateralDirection.lengthSq() < .01) lateralDirection.set(1, 0, 0);
    const bendAmount = branchLength * (.04 + randomNumber() * .06) * (randomNumber() < .5 ? -1 : 1);
    const firstControl = startPosition.clone().addScaledVector(initialTangent || displacement.clone().normalize(), branchLength * .32);
    firstControl.addScaledVector(lateralDirection, bendAmount * .35);
    const secondControl = startPosition.clone().lerp(endPosition, .68).addScaledVector(lateralDirection, bendAmount);
    if (!isTrunk) secondControl.y -= branchLength * .045;
    const curve = new THREE.CubicBezierCurve3(startPosition.clone(), firstControl, secondControl, endPosition.clone());
    const mesh = new THREE.Mesh(createTaperedBranchGeometry(curve, baseRadius, tipRadius, randomNumber() * 20, isTrunk), material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    return curve;
  }

  function twigSpray(parentCurve, parentRadius, length, depth, azimuth, droopAmount) {
    if (depth === 0) return;
    const childCount = depth === 3 ? 4 : 3;
    for (let childIndex = 0; childIndex < childCount; childIndex++) {
      const attachmentFraction = .36 + childIndex * .17 + randomNumber() * .09;
      const startPosition = parentCurve.getPointAt(attachmentFraction);
      const tangent = parentCurve.getTangentAt(attachmentFraction);
      const childAngle = azimuth + childIndex * 2.399 + (randomNumber() - .5) * .9;
      const childLength = length * (.65 + randomNumber() * .55);
      const outwardDirection = new THREE.Vector3(Math.cos(childAngle), .28 + randomNumber() * .55 - droopAmount, Math.sin(childAngle));
      outwardDirection.addScaledVector(tangent, 1.25).normalize();
      const endPosition = startPosition.clone().addScaledVector(outwardDirection, childLength);
      const radius = parentRadius * (.38 + (1 - attachmentFraction) * .24);
      const childCurve = branch(startPosition, endPosition, radius, Math.max(.0015, radius * .13), tangent);
      twigSpray(childCurve, radius, childLength * .54, depth - 1, childAngle + .8, droopAmount);
    }
  }

  function deciduousTree(rootPosition, crownCenters, trunkRadius = .27, species = 'maple') {
    const averageCrown = new THREE.Vector3();
    for (const crownCenter of crownCenters) averageCrown.add(crownCenter);
    averageCrown.multiplyScalar(1 / crownCenters.length);
    const trunkTop = rootPosition.clone().lerp(averageCrown, .58);
    trunkTop.x += (randomNumber() - .5) * .9;
    trunkTop.z += (randomNumber() - .5) * .6;
    const trunkCurve = branch(rootPosition, trunkTop, trunkRadius, trunkRadius * .34, new THREE.Vector3(.1, 1, .04).normalize(), true);
    for (let limbIndex = 0; limbIndex < crownCenters.length; limbIndex++) {
      const attachmentFraction = .42 + limbIndex / crownCenters.length * .5;
      const limbStart = trunkCurve.getPointAt(attachmentFraction);
      const limbEnd = crownCenters[limbIndex].clone();
      const limbRadius = trunkRadius * (.53 - limbIndex * .045);
      const limbCurve = branch(limbStart, limbEnd, limbRadius, limbRadius * .16, trunkCurve.getTangentAt(attachmentFraction));
      const azimuth = Math.atan2(limbEnd.z - limbStart.z, limbEnd.x - limbStart.x);
      twigSpray(limbCurve, limbRadius, 2.1, 3, azimuth, species === 'cherry' ? .38 : 0);
      // Continue each scaffold into a fine leader; avoid blunt-ended poles.
      const leaderEnd = limbEnd.clone().addScaledVector(limbCurve.getTangentAt(1), 1.0 + randomNumber() * .6);
      const leader = branch(limbEnd, leaderEnd, limbRadius * .16, .0025, limbCurve.getTangentAt(1));
      twigSpray(leader, limbRadius * .16, .65, 2, azimuth + 1, .1);
    }
  }

  function shrub(rootPosition, height) {
    for (let stemIndex = 0; stemIndex < 5; stemIndex++) {
      const angle = stemIndex * 2.399 + randomNumber();
      const stemEnd = rootPosition.clone().add(new THREE.Vector3(Math.cos(angle) * (1 + randomNumber() * .5), height * (.66 + randomNumber() * .35), Math.sin(angle) * 1.3));
      const stem = branch(rootPosition, stemEnd, .045 + randomNumber() * .02, .006, new THREE.Vector3(Math.cos(angle) * .2, 1, Math.sin(angle) * .2).normalize());
      twigSpray(stem, .045, .8, 2, angle, 0);
    }
  }

  return { branch, deciduousTree, shrub };
}
