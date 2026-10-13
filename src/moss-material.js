// Continuous object-space cushions: broad moisture gradients, tiny leaf tips,
// and filtered micro-relief instead of a magnified repeating photograph.
export function enrichMossMaterial(material) {
  material.bumpMap = null;
  material.onBeforeCompile = function compileMossSurface(shader) {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `
      #include <common>
      attribute float mossSeed;
      varying vec3 mossSurfacePosition;
      varying float mossSurfaceSeed;
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      mossSurfacePosition = position;
      mossSurfaceSeed = mossSeed;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `
      #include <common>
      varying vec3 mossSurfacePosition;
      varying float mossSurfaceSeed;
      float mossHash(vec3 coordinate) {
        coordinate = fract(coordinate * .3183099 + vec3(.13,.37,.73));
        coordinate *= 17.0;
        return fract(coordinate.x * coordinate.y * coordinate.z * (coordinate.x + coordinate.y + coordinate.z));
      }
      float mossNoise(vec3 coordinate) {
        vec3 cell = floor(coordinate);
        vec3 fraction = fract(coordinate);
        fraction = fraction * fraction * (3.0 - 2.0 * fraction);
        return mix(mix(mix(mossHash(cell), mossHash(cell+vec3(1,0,0)),fraction.x),
          mix(mossHash(cell+vec3(0,1,0)),mossHash(cell+vec3(1,1,0)),fraction.x),fraction.y),
          mix(mix(mossHash(cell+vec3(0,0,1)),mossHash(cell+vec3(1,0,1)),fraction.x),
          mix(mossHash(cell+vec3(0,1,1)),mossHash(cell+vec3(1,1,1)),fraction.x),fraction.y),fraction.z);
      }
    `).replace('#include <map_fragment>', `
      #include <map_fragment>
      vec3 mossPosition = mossSurfacePosition + vec3(mossSurfaceSeed, 0.0, mossSurfaceSeed * .71);
      float moisture = mossNoise(mossPosition * .56);
      float cushion = mossNoise(mossPosition * 3.4 + moisture * 2.0);
      float leafVisibility = 1.0 - smoothstep(.65,2.0,length(fwidth(mossPosition * 17.0)));
      float leafTips = mix(.5,mossNoise(mossPosition * vec3(17.0,9.6,17.0)),leafVisibility);
      float mossTufts = mossNoise(mossPosition * 8.4 + vec3(cushion * 2.0));
      float fineCoverage = smoothstep(.2,.8,cushion);
      vec3 deepGreen = vec3(.065,.087,.029);
      vec3 livingGreen = vec3(.120,.151,.050);
      vec3 oliveTips = vec3(.175,.186,.073);
      vec3 mossColor = mix(deepGreen,livingGreen,smoothstep(.13,.83,moisture));
      mossColor = mix(mossColor,oliveTips,smoothstep(.48,.86,moisture) * (.24 + .30 * fineCoverage));
      float edgeHeight = smoothstep(-.005,.10,mossSurfacePosition.y);
      mossColor *= mix(.77,1.0,edgeHeight) * (.82 + .18 * leafTips + .08 * mossTufts);
      mossColor += vec3(.018,.023,.008) * smoothstep(.61,.82,leafTips) * leafVisibility;
      diffuseColor.rgb = mossColor;
      float mossRelief = cushion * .0012 + mossTufts * .002 + leafTips * .0035;
    `).replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor = .97;
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 mossSurfaceX = dFdx(-vViewPosition);
      vec3 mossSurfaceY = dFdy(-vViewPosition);
      vec3 mossCrossX = cross(mossSurfaceY,normal);
      vec3 mossCrossY = cross(normal,mossSurfaceX);
      float mossDeterminant = dot(mossSurfaceX,mossCrossX) * faceDirection;
      vec3 mossGradient = sign(mossDeterminant) * (dFdx(mossRelief) * mossCrossX + dFdy(mossRelief) * mossCrossY);
      normal = normalize(abs(mossDeterminant) * normal - mossGradient);
    `);
  };
  material.customProgramCacheKey = function mossShaderKey() { return 'moss-cushion-v2-broad-quiet-grain'; };
  return material;
}
