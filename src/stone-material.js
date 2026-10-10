// Object-space mineral detail remains continuous across UV seams and follows
// each stone when it is moved or rotated. This is an artistic material, not a
// geological identification of the reference garden's stones.
export function enrichStoneMaterial(material) {
  material.onBeforeCompile = function compileStoneSurface(shader) {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      attribute float stoneSeed;
      varying vec3 stoneSurfacePosition;
      varying float stoneSurfaceSeed;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      stoneSurfacePosition = position;
      stoneSurfaceSeed = stoneSeed;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 stoneSurfacePosition;
      varying float stoneSurfaceSeed;
      float mineralHash(vec3 coordinate) {
        coordinate = fract(coordinate * 0.3183099 + vec3(0.13, 0.37, 0.73));
        coordinate *= 17.0;
        return fract(coordinate.x * coordinate.y * coordinate.z * (coordinate.x + coordinate.y + coordinate.z));
      }
      float mineralNoise(vec3 coordinate) {
        vec3 cell = floor(coordinate);
        vec3 fraction = fract(coordinate);
        fraction = fraction * fraction * (3.0 - 2.0 * fraction);
        return mix(
          mix(mix(mineralHash(cell), mineralHash(cell + vec3(1,0,0)), fraction.x),
              mix(mineralHash(cell + vec3(0,1,0)), mineralHash(cell + vec3(1,1,0)), fraction.x), fraction.y),
          mix(mix(mineralHash(cell + vec3(0,0,1)), mineralHash(cell + vec3(1,0,1)), fraction.x),
              mix(mineralHash(cell + vec3(0,1,1)), mineralHash(cell + vec3(1,1,1)), fraction.x), fraction.y), fraction.z);
      }
    `).replace('#include <map_fragment>', `
      #include <map_fragment>
      vec3 mineralPosition = stoneSurfacePosition + vec3(stoneSurfaceSeed, stoneSurfaceSeed * 1.73, stoneSurfaceSeed * 0.61);
      float mineralCloud = mineralNoise(mineralPosition * 3.2);
      float mineralGrain = mineralNoise(mineralPosition * 24.0);
      float grainVisibility = 1.0 - smoothstep(0.45, 1.4, length(fwidth(mineralPosition * 130.0)));
      float mineralFineGrain = mix(0.5, mineralNoise(mineralPosition * 130.0), grainVisibility);
      float mineralFlecks = smoothstep(0.66, 0.83, mineralFineGrain);
      float mineralPores = 1.0 - smoothstep(0.19, 0.36, mineralFineGrain);
      float mineralVeinField = mineralNoise(mineralPosition * vec3(5.0, 8.0, 5.0) + vec3(mineralCloud * 2.0));
      float mineralVein = 1.0 - smoothstep(0.018, 0.065, abs(mineralVeinField - 0.54));
      float mineralCrevice = 1.0 - smoothstep(0.025, 0.075, abs(mineralNoise(mineralPosition * 11.0) - 0.37));
      float mineralStrata = sin(mineralPosition.y * 55.0 + mineralPosition.x * 6.0 + mineralCloud * 9.0) * 0.5 + 0.5;
      vec3 mineralColor = mix(vec3(0.075, 0.083, 0.089), vec3(0.245, 0.240, 0.216), mineralCloud * 0.38 + mineralGrain * 0.62);
      mineralColor *= 0.76 + mineralFineGrain * 0.48 + mineralStrata * 0.07;
      mineralColor = mix(mineralColor, vec3(0.34, 0.325, 0.275), mineralVein * 0.35);
      mineralColor += mineralFlecks * vec3(0.18, 0.175, 0.15);
      mineralColor *= 1.0 - mineralPores * 0.45 - mineralCrevice * 0.20;
      float baseWeathering = (1.0 - smoothstep(0.02, 0.28, stoneSurfacePosition.y)) * smoothstep(0.4, 0.65, mineralGrain);
      mineralColor = mix(mineralColor, vec3(0.07, 0.085, 0.038), baseWeathering * 0.45);
      diffuseColor.rgb = mineralColor;
      float mineralRelief = mineralGrain * 0.012 + mineralFineGrain * 0.0015 + mineralVein * 0.003 - mineralCrevice * 0.004 - mineralPores * 0.002;
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = clamp(0.88 + mineralGrain * 0.10 - mineralFlecks * 0.14, 0.74, 1.0);
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 mineralSurfaceX = dFdx(-vViewPosition);
      vec3 mineralSurfaceY = dFdy(-vViewPosition);
      vec3 mineralCrossX = cross(mineralSurfaceY, normal);
      vec3 mineralCrossY = cross(normal, mineralSurfaceX);
      float mineralDeterminant = dot(mineralSurfaceX, mineralCrossX) * faceDirection;
      vec3 mineralGradient = sign(mineralDeterminant) * (dFdx(mineralRelief) * mineralCrossX + dFdy(mineralRelief) * mineralCrossY);
      normal = normalize(abs(mineralDeterminant) * normal - mineralGradient);
    `);
  };
  material.customProgramCacheKey = function stoneShaderKey() { return 'weathered-mineral-stone-v1'; };
  return material;
}
