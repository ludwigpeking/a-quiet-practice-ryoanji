import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const captureDirectory = path.resolve(projectDirectory, '../releases/itch/capture');
await mkdir(captureDirectory, { recursive: true });
const captureControls = `
const capturePresets = {
  stone: {position: [-5.8,3.6,4.5], target: [-8.15,.2,.1], fieldOfView: 46, season: 'summer'},
  grooves: {position: [2.9,4.5,4.9], target: [.1,0,-.65], fieldOfView: 44, season: 'spring'},
  moss: {position: [5.6,2.7,4.4], target: [8.1,.2,.25], fieldOfView: 48, season: 'autumn'}
};
const capturePreset = capturePresets[new URLSearchParams(location.search).get('shot')] || capturePresets.stone;
controls.minDistance = 0; controls.maxDistance = 100;
controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI;
controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
controls.enableDamping = false;
controls.enabled = false;
camera.position.set(...capturePreset.position);
controls.target.set(...capturePreset.target);
camera.fov = capturePreset.fieldOfView;
camera.updateProjectionMatrix(); controls.update();
setSeason(capturePreset.season);
isContemplating = true;
document.body.classList.add('store-capture');
renderRequested = true;
`;
const buildResult = await build({absWorkingDir: projectDirectory, entryPoints: ['src/main.js'], outfile: 'capture.js', bundle: true, format: 'iife', write: false, minify: true,
  plugins: [{name: 'capture-viewpoints', setup: function configureCapture(buildContext) {
    buildContext.onLoad({filter: /[\\/]src[\\/]main\.js$/}, async function loadCaptureEntry(argumentsObject) {
      return {contents: (await readFile(argumentsObject.path, 'utf8')).replace("const storageKey = 'ryoanji-garden-v1';", "const storageKey = 'store-capture-isolated';") + captureControls, loader: 'js'};
    });
  }}]
});
const javascript = buildResult.outputFiles.find(function isJavaScript(file) {return file.path.endsWith('.js');}).text;
const stylesheet = buildResult.outputFiles.find(function isStylesheet(file) {return file.path.endsWith('.css');}).text.replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, '');
let documentSource = await readFile(path.join(projectDirectory, 'index.html'), 'utf8');
documentSource = documentSource.replace('</head>', function addStyles() {return '<style>' + stylesheet + '\nbody.store-capture #experience > :not(canvas), body.store-capture > :not(main):not(script) {display:none !important;} </style></head>';});
documentSource = documentSource.replace('<script type="module" src="/src/main.js"></script>', function addScript() {return '<script>' + javascript.replace(/<\/script/gi, '<\\/script') + '</script>';});
await writeFile(path.join(captureDirectory, 'index.html'), documentSource);
console.log('Capture-only viewpoints built; game release is unchanged.');
