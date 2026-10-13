import { defineConfig } from 'vite';

// The site is served from https://ludwigpeking.github.io/a-quiet-practice-ryoanji/
// so every asset URL needs this repository prefix. Local dev and the itch.io
// package keep a relative base.
export default defineConfig(function configureBuild(options) {
  const buildingForGitHubPages = process.env.GITHUB_PAGES === 'true';
  return {
    base: buildingForGitHubPages ? '/a-quiet-practice-ryoanji/' : './',
  };
});
