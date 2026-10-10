import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStone, seatStoneOnTerrain } from '../src/scene.js';
import { applyBrush, sampleHeight, COLUMN_COUNT, ROW_COUNT } from '../src/terrain.js';

test('moss stays rooted across raised and pressed ground, at different rotations and scales', function conformMoss() {
  const material = new THREE.MeshStandardMaterial();
  for (const shape of ['spire', 'reclining', 'mountain', 'split']) {
    const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
    const stone = createStone({ positionX: .1, positionZ: .2, rotation: .83, size: 1.4, shape, seed: 43 }, material, material);
    const originalRockPositions = stone.children[0].geometry.attributes.position.array.slice();
    for (const tool of ['raise', 'press']) {
      for (let strokeIndex = 0; strokeIndex < (tool === 'press' ? 32 : 16); strokeIndex++) applyBrush(heights, { worldX: .45, worldZ: .1, radius: 1.3, pressure: .8, tool, directionX: 1, directionZ: 0, elapsedSeconds: .05 });
      assert.ok(sampleHeight(heights, .45, .1) * (tool === 'raise' ? 1 : -1) > .2, 'sand underneath the island rises and sinks with the brush');
      for (const scale of [.5, 1.8]) {
        stone.scale.setScalar(scale); stone.rotation.y += .4;
        seatStoneOnTerrain(stone, heights);
        stone.updateMatrixWorld(true);
        const moss = stone.userData.moss;
        const positions = moss.geometry.attributes.position;
        const basePositions = stone.userData.mossBasePositions;
        const worldPosition = new THREE.Vector3();
        for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {
          worldPosition.fromBufferAttribute(positions, vertexIndex).applyMatrix4(stone.matrixWorld);
          const terrainHeight = sampleHeight(heights, worldPosition.x, worldPosition.z);
          const expectedHeight = terrainHeight + basePositions[vertexIndex * 3 + 1] * scale;
          assert.ok(Math.abs(worldPosition.y - expectedHeight) < 1e-6, 'moss volume follows local terrain, without hovering at the center height');
        }
        assert.deepEqual(stone.children[0].geometry.attributes.position.array, originalRockPositions, 'rock remains rigid');
        const fittedPositions = positions.array.slice();
        seatStoneOnTerrain(stone, heights);
        assert.deepEqual(positions.array, fittedPositions, 'refitting does not accumulate deformation');
      }
    }
    for (const child of stone.children) child.geometry.dispose();
  }
  material.dispose();
});

test('unchanged ghost placement reuses its fit; terrain edits and movement invalidate it', function cachedGrounding() {
  const material = new THREE.MeshStandardMaterial();
  const heights = new Float32Array(COLUMN_COUNT * ROW_COUNT);
  const stone = createStone({ positionX: 0, positionZ: 0, rotation: 0, size: 1, shape: 'mountain', seed: 21 }, material, material);
  seatStoneOnTerrain(stone, heights, 0);
  const positionsVersion = stone.userData.moss.geometry.attributes.position.version;
  assert.equal(seatStoneOnTerrain(stone, heights, 0), false);
  assert.equal(stone.userData.moss.geometry.attributes.position.version, positionsVersion);
  applyBrush(heights, { worldX: .6, worldZ: 0, radius: 1, pressure: 1, tool: 'raise', directionX: 1, directionZ: 0, elapsedSeconds: .5 });
  assert.equal(seatStoneOnTerrain(stone, heights, 1), true);
  stone.position.x = 2;
  assert.equal(seatStoneOnTerrain(stone, heights, 1), true);
  for (const child of stone.children) child.geometry.dispose();
  material.dispose();
});
