import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

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
});

test('public page is plain while keeping the clinical and privacy boundaries visible', () => {
  const app = read('../landing/src/App.tsx');

  assert.match(app, /<>\s*<PublicEstateHeader current="scratchpad"[\s\S]*?<div className="site-shell">/, 'header must sit outside the page-specific content shell');
  assert.match(app, /<h1 id="page-title">Clinical Shift Scratchpad<\/h1>/);
  assert.match(app, /Do not enter patient-identifiable information/);
  assert.match(app, /not a medical record/);
  assert.match(app, /No backend/);
  assert.match(app, /Source on GitHub/);
  assert.doesNotMatch(app, /eyebrow|boundary-label|>0[1-4]</);
});

test('public page uses current screenshots as aligned evidence and shared theme persistence', () => {
  const app = read('../landing/src/App.tsx');
  const styles = read('../landing/src/styles.css');
  const theme = read('../landing/src/lib/theme.ts');

  assert.match(app, /scratchpad-active-list\.webp/);
  assert.match(app, /scratchpad-edit-job\.webp/);
  assert.match(styles, /\.screenshots \{[^}]*align-items: end;/s);
  assert.match(app, /PublicEstateHeader/);
  assert.match(theme, /sangeevSiteTheme/);
  assert.match(theme, /Domain=\.sangeev\.me/);
  assert.ok(theme.indexOf('const cookie = readCookie()') < theme.indexOf('window.localStorage.getItem'), 'cross-subdomain cookie should take precedence over stale origin storage');
});
