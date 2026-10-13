import { build } from 'esbuild';
import { zipSync, strToU8, unzipSync } from 'three/addons/libs/fflate.module.js';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const releaseDirectory = path.resolve(projectDirectory,'../releases/itch');
const gameDirectory = path.join(releaseDirectory,'A Quiet Practice');
await mkdir(gameDirectory,{recursive:true});
const buildResult = await build({
  absWorkingDir:projectDirectory,entryPoints:['src/main.js'],outfile:'garden.js',
  bundle:true,format:'iife',target:'chrome110',minify:true,write:false,
  plugins:[{name:'download-edition',setup:function configureDownload(buildContext) {
    buildContext.onLoad({filter:/[\\/]src[\\/]main\.js$/},async function readEntry(argumentsObject) {
      const source = (await readFile(argumentsObject.path,'utf8'))
        .replaceAll('ryoanji-wallpaper.zip','a-quiet-practice-wallpaper.zip')
        .replace("const storageKey = 'ryoanji-garden-v1';","const storageKey = 'a-quiet-practice-garden-v1';");
      return {contents:source,loader:'js'};
    });
  }}]
});
const script = buildResult.outputFiles.find(function isJavaScript(file) {return file.path.endsWith('.js');}).text;
const stylesheet = buildResult.outputFiles.find(function isStylesheet(file) {return file.path.endsWith('.css');}).text.replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g,'');
let gameDocument = await readFile(path.join(projectDirectory,'index.html'),'utf8');
gameDocument = gameDocument
  .replace('<title>Ryōan-ji — A quiet practice</title>','<title>A Quiet Practice</title>')
  .replace('shape a quiet corner of Kyoto in this interactive Three.js garden.','shape your own quiet courtyard in this interactive garden.')
  .replace('aria-label="Interactive Ryōan-ji inspired garden"','aria-label="A Quiet Practice — interactive garden"')
  .replace('<h1>RYŌAN-JI</h1><p>A QUIET PRACTICE</p>','<h1>A QUIET PRACTICE</h1><p>AN INTERACTIVE GARDEN</p>')
  .replace('KYOTO, JAPAN','YOUR QUIET COURTYARD')
  .replace('This is an artistic interpretation of Ryōan-ji’s dry landscape garden, seen from beneath the timber eaves.','An independent garden-making experience by Richard Qian Li, inspired by Japanese dry landscape gardens and seen from beneath timber eaves.')
  .replaceAll('ryoanji-wallpaper.zip','a-quiet-practice-wallpaper.zip')
  .replace('</head>',function inlineStyles() {return `<style>${stylesheet}</style></head>`;})
  .replace('<script type="module" src="/src/main.js"></script>',function inlineScript() {return `<script>${script.replace(/<\/script/gi,'<\\/script')}</script>`;});
const thirdPartyLicense = 'Three.js\n\n'+await readFile(path.join(projectDirectory,'node_modules/three/LICENSE'),'utf8');
const wallpaperDocument = gameDocument.replace('<body class="is-loading">','<body class="is-loading wallpaper" data-wallpaper="true">');
const wallpaperEntries = {
  'index.html':strToU8(wallpaperDocument),
  'LivelyInfo.json':strToU8(JSON.stringify({AppVersion:'2.0.0.0',Title:'A Quiet Practice',Desc:'An offline garden with seasonal trees and a gentle breeze. Silent, 30 fps by default.',Author:'Richard Qian Li',Type:1,FileName:'index.html',IsAbsolutePath:false,Arguments:'--pause-event true',Version:1},null,2)),
  'LivelyProperties.json':strToU8(JSON.stringify({season:{type:'dropdown',value:1,text:'Season',items:['Spring','Summer','Autumn','Winter']},frameRate:{type:'dropdown',value:2,text:'Frame rate limit',items:['15 fps','24 fps','30 fps','60 fps']}},null,2)),
  'README.txt':strToU8('Drag this ZIP into Lively Wallpaper on Windows. Keep it zipped. Right-click its tile > Customize to change the season or frame rate. The wallpaper is silent and does not accept garden-editing input. Lively is separate software, not included.\n'),
  'THIRD-PARTY-LICENSE.txt':strToU8(thirdPartyLicense)
};
const instructions = `A QUIET PRACTICE — 1.0.0
Created by Richard Qian Li, ITP, NYU

START
1. Extract this ZIP to a folder. Do not open the game inside the ZIP viewer.
2. Open index.html in a current Chrome or Edge browser.
3. Click Enter garden to begin with nature sounds and full screen.
   Escape leaves full screen. The tools include sound and full-screen controls.
4. Enable browser hardware acceleration if the garden cannot start.
No installation, account, local server, or Internet connection is required to play.
Keep the extracted folder together. Desktop mouse and keyboard recommended.

CONTROLS
Touch or hover the small garden sign to show tools.
1 Rake / 2 Raise / 3 Press / 4 Push / 5 Smooth / 6 Stones.
Drag to work the sand. [ and ] change brush width or stone scale.
7,8,9,0 or Z,X,C,V choose the four stone forms.
Click to place a stone; drag to move; R rotates; E or Delete erases.
Right-drag looks around; mouse wheel zooms.
Ctrl/Cmd+Z undoes. Clear garden removes stones and flattens the sand.
Save stores the garden in this browser. Local-file storage behavior varies by browser:
keep the same browser and folder path; private browsing or clearing browser data may lose saves.
Perspective changes viewpoint. Contemplate hides controls; Escape returns.
Soft wind and summer cicadas begin when you enter. The sound button mutes them.

WALLPAPER (WINDOWS)
Install Lively Wallpaper separately: https://www.rocksdanister.com/lively/
Drag a-quiet-practice-wallpaper.zip into Lively without extracting that inner ZIP.
Customize its season and frame rate from Lively. Wallpaper playback is silent,
uses its own original garden, and does not edit or synchronize your saved garden.

ABOUT
A contemplative garden-making experience, with no score and no finish line.
An independent artistic interpretation, not an official temple product.
Geometry, textures, vegetation and in-game sound are generated by the app.
The promotional film includes additional nature recordings and directed scenes.
Those film-only effects and compositions are not a promise of additional game modes.
Three.js license is included in THIRD-PARTY-LICENSE.txt.
`;
const files = {
  'index.html':strToU8(gameDocument),
  'a-quiet-practice-wallpaper.zip':zipSync(wallpaperEntries,{level:6}),
  'START HERE.txt':strToU8(instructions),
  'THIRD-PARTY-LICENSE.txt':strToU8(thirdPartyLicense)
};
for (const [filename,bytes] of Object.entries(files)) await writeFile(path.join(gameDirectory,filename),bytes);
const archive = zipSync(files,{level:6});
const archivePath = path.join(releaseDirectory,'A-Quiet-Practice-1.0.0.zip');
await writeFile(archivePath,archive);
const unpacked = unzipSync(archive);
if (Object.keys(unpacked).length !== 4 || !unpacked['index.html'] || /<script[^>]+src=|<link[^>]+rel="stylesheet"|@import\s/.test(gameDocument)) throw new Error('Offline archive validation failed.');
await copyFile(path.resolve(projectDirectory,'../film/releases/v7/cover_en_1920x1080.png'),path.join(releaseDirectory,'cover-landscape.png'));
await writeFile(path.join(releaseDirectory,'package-check.json'),JSON.stringify({title:'A Quiet Practice',version:'1.0.0',priceUSD:1.99,archiveBytes:archive.byteLength,files:Object.keys(unpacked),standaloneHTML:true,interactive:true,wallpaperIncluded:true},null,2));
console.log(`Ready: ${archivePath} (${archive.byteLength} bytes)`);
