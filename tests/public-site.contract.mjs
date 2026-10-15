import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import './public-routing.contract.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const fontLicenses = ['OFL-Atkinson-Hyperlegible-Next.txt', 'OFL-Literata.txt'];

test('public page uses a dedicated typed Vite React entrypoint', () => {
  const packageJson = JSON.parse(read('../package.json'));
  const html = read('../landing/index.html');
  const vite = read('../landing/vite.config.ts');

  assert.equal(packageJson.scripts['build:site'], 'tsc -b landing/tsconfig.json && vite build --config landing/vite.config.ts');
  assert.ok(vite.includes('base: "./"'));
  assert.ok(vite.includes('assetFileNames: "assets/[name]-[hash][extname]"'));
  assert.doesNotMatch(vite, /\? "styles\.css"/);
  assert.match(html, /src="\/src\/main\.tsx"/);
  assert.match(html, /id="root"/);
  assert.doesNotMatch(html, /sangeev-public-tokens\.css/);
  for (const license of fontLicenses) {
    const canonical = read(`../node_modules/@sangeev/estate-ui/LICENSES/${license}`);
    assert.equal(read(`../landing/public/licenses/${license}`), canonical, `source font licence drift: ${license}`);
    assert.equal(read(`../docs/licenses/${license}`), canonical, `deployed font licence drift: ${license}`);
  }
});

test('public page distributes the shared UI MIT licence verbatim', () => {
  const canonical = read('../node_modules/@sangeev/estate-ui/LICENSE');
  for (const directory of ['landing/public', 'docs']) {
    assert.equal(read(`../${directory}/licenses/MIT-estate-ui.txt`), canonical);
  }
});

test('public page publishes canonical crawler discovery files', () => {
  for (const directory of ['landing/public', 'docs']) {
    const robots = read(`../${directory}/robots.txt`);
    const sitemap = read(`../${directory}/sitemap.xml`);
    assert.equal(robots, 'User-agent: *\nAllow: /\n\nSitemap: https://scratchpad.sangeev.me/sitemap.xml\n');
    assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(sitemap, /<loc>https:\/\/scratchpad\.sangeev\.me\/<\/loc>/);
    assert.doesNotMatch(sitemap, /<html\b/i);
  }
});

test('public page uses the shared project template while keeping the clinical and privacy boundaries visible', () => {
  const app = read('../landing/src/App.tsx');
  const page = read('../landing/src/ProjectPage.tsx');
  const project = read('../landing/src/project.ts');
  const packageJson = JSON.parse(read('../package.json'));

  assert.match(app, /<ProjectPage project=\{project\} \/>/);
  assert.match(page, /from "@sangeev\/estate-ui"/);
  assert.match(page, /<>\s*<a className="skip-link" href="#main-content">Skip to content<\/a>\s*<PublicEstateHeader current=\{project\.key as EstatePage\}[\s\S]*?<EstateShell variant="landing">/, 'header must sit outside the named shared shell');
  assert.equal(packageJson.dependencies['@sangeev/estate-ui'], 'file:vendor/sangeev-estate-ui-2.0.0-alpha.7.tgz');
  assert.match(page, /<EstatePageTitle id="page-title" variant="landing">\s*\{project\.name\}<span className="title-stop">\.<\/span>/);
  for (const title of ['See it working', 'What you can do', 'What it won’t do', 'Before you use it']) assert.ok(page.includes(title), title);
  assert.match(page, /const homeHref = `https:\/\/sangeev\.me\/#\$\{project\.key\}`;/);
  assert.match(page, /Source code and notes on GitHub/);
  assert.match(project, /key: "scratchpad"/);
  assert.match(project, /name: "Clinical Shift Scratchpad"/);
  assert.match(project, /anything that could identify a patient/);
  assert.match(project, /Your jobs stay on your phone\. There’s no account, and nothing is sent anywhere\./);
  assert.match(project, /sourceHref: "https:\/\/github\.com\/Snowslash\/clinical-shift-scratchpad"/);
  assert.match(project, /actions: \[\]/, 'the scratchpad is a phone app, so the page has nothing to open');
  assert.doesNotMatch(page + project, /<Github/);
  assert.doesNotMatch(page + project, /Expo · React Native · local-first|not a medical record|source of truth for patient care/);
  assert.doesNotMatch(page, /eyebrow|boundary-label|>0[1-4]</);
});

test('public page shows current screenshots as prints and keeps shared theme persistence', () => {
  const page = read('../landing/src/ProjectPage.tsx');
  const project = read('../landing/src/project.ts');
  const styles = read('../landing/src/styles.css');
  const main = read('../landing/src/main.tsx');

  assert.match(project, /scratchpad-active-list\.webp/);
  assert.match(project, /scratchpad-edit-job\.webp/);
  assert.match(page, /<dialog/, 'a held screenshot is a modal dialog');
  assert.match(styles, /@sangeev\/estate-ui\/contract\.css/);
  assert.match(page, /PublicEstateHeader/);
  assert.match(page, /useEstateTheme/);
  assert.match(main, /initialiseEstateTheme\(\)/);
});

test('public landing links keep their accessible foreground colour on hover', () => {
  const styles = read('../landing/src/project-page.css');

  assert.doesNotMatch(styles, /:hover \{[^}]*color: var\(--accent\)/);
  assert.match(styles, /\.back-link:hover \{ text-decoration-line: underline; \}/);
  assert.match(styles, /\.desk-footer a:hover \{ text-decoration-line: underline; \}/);
});

test('Deep Atlas starts with matching browser chrome and the dark desk', () => {
  assert.match(read('../landing/index.html'), /name="theme-color" content="#061e1d"/);
  assert.match(read('../landing/src/project-page.css'), /\[data-theme="dark"\],\s*\.dark \{\s*--desk-ground: var\(--estate-night\);/);
});

test('motion on the project page respects reduced-motion settings', () => {
  const styles = read('../landing/src/project-page.css');
  const page = read('../landing/src/ProjectPage.tsx');

  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(page, /prefers-reduced-motion: reduce/);
});
