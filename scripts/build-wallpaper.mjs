import { build } from 'esbuild';
import { zipSync, strToU8 } from 'three/addons/libs/fflate.module.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = path.join(projectDirectory, 'wallpaper-build');
const publicDirectory = path.join(projectDirectory, 'public');
await mkdir(outputDirectory, { recursive: true });
await mkdir(publicDirectory, { recursive: true });

// A classic, self-contained script also works from a local file in Lively's
// Chromium player: no module server, external font request, or sign-in needed.
const bundle = await build({
  absWorkingDir: projectDirectory,
  entryPoints: ['src/main.js'],
  outfile: 'garden.js',
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  minify: true,
  write: false,
});
const script = bundle.outputFiles.find(function javascriptFile(file) { return file.path.endsWith('.js'); }).text;
const styles = bundle.outputFiles.find(function stylesheetFile(file) { return file.path.endsWith('.css'); }).text
  .replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, '');
let document = await readFile(path.join(projectDirectory, 'index.html'), 'utf8');
document = document.replace('<body class="is-loading">', '<body class="is-loading wallpaper" data-wallpaper="true">');
document = document.replace('</head>', function inlineStyles() { return `<style>${styles}</style></head>`; });
document = document.replace('<script type="module" src="/src/main.js"></script>', function inlineScript() {
  return `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`;
});

const information = {
  AppVersion: '2.0.0.0', Title: 'Ryōan-ji — A quiet garden',
  Desc: 'A shaded veranda, raked gravel and seasonal trees moving in a gentle breeze. Offline, silent, and capped at 30 fps by default.',
  Author: 'newa', Type: 1, FileName: 'index.html', IsAbsolutePath: false,
  Arguments: '--pause-event true', Version: 1,
};
const properties = {
  season: { type: 'dropdown', value: 1, text: 'Season', items: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  frameRate: { type: 'dropdown', value: 2, text: 'Frame rate limit', items: ['15 fps', '24 fps', '30 fps', '60 fps'] },
};
const instructions = 'Drag ryoanji-wallpaper.zip into Lively Wallpaper. Select the garden to apply it.\nRight-click its tile > Customize to change season or frame rate.\nThe wallpaper is silent and ignores mouse and keyboard input.\nLively playback pauses stop garden animation; configure pause rules in Lively settings.\nNo server or Internet connection is required.\n';
const license = await readFile(path.join(projectDirectory, 'node_modules/three/LICENSE'), 'utf8');
const files = {
  'index.html': document,
  'LivelyInfo.json': JSON.stringify(information, null, 2),
  'LivelyProperties.json': JSON.stringify(properties, null, 2),
  'README.txt': instructions,
  'THIRD-PARTY-LICENSE.txt': `Three.js\n${license}`,
};
const archiveEntries = {};
for (const [name, content] of Object.entries(files)) {
  await writeFile(path.join(outputDirectory, name), content);
  archiveEntries[name] = strToU8(content);
}
const archivePath = path.join(publicDirectory, 'ryoanji-wallpaper.zip');
await writeFile(archivePath, zipSync(archiveEntries, { level: 6 }));
console.log(`Offline Lively wallpaper ready: ${archivePath}`);
