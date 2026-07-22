import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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

test('public page is plain while keeping the clinical and privacy boundaries visible', () => {
  const app = read('../landing/src/App.tsx');
  const packageJson = JSON.parse(read('../package.json'));

  assert.match(app, /from "@sangeev\/estate-ui"/);
  assert.match(app, /<>\s*<PublicEstateHeader current="scratchpad"[\s\S]*?<EstateShell variant="landing">/, 'header must sit outside the named shared shell');
  assert.equal(packageJson.dependencies['@sangeev/estate-ui'], 'file:vendor/sangeev-estate-ui-2.0.0-alpha.3.tgz');
  assert.match(app, /<EstatePageTitle id="page-title" variant="landing">Clinical Shift Scratchpad<\/EstatePageTitle>/);
  assert.match(app, /<EstateSectionTitle id="evidence-title">Built for the busy middle of a shift\.<\/EstateSectionTitle>/);
  assert.match(app, /<EstateSectionTitle id="capabilities-title">A scratchpad, deliberately\.<\/EstateSectionTitle>/);
  assert.match(app, /<EstateSectionTitle id="status-title">Personal prototype\. Narrow on purpose\.<\/EstateSectionTitle>/);
  assert.match(app, /Do not enter patient-identifiable information/);
  assert.match(app, /No backend/);
  assert.match(app, /className="estate-primary-action estate-icon-action" href="https:\/\/github\.com\/Snowslash\/clinical-shift-scratchpad" aria-label="Source on GitHub" title="Source on GitHub"><GitHubMark/);
  assert.doesNotMatch(app, /<Github/);
  assert.doesNotMatch(app, /Expo · React Native · local-first|not a medical record|source of truth for patient care/);
  assert.doesNotMatch(app, /eyebrow|boundary-label|>0[1-4]</);
});

test('public page uses current screenshots as aligned evidence and shared theme persistence', () => {
  const app = read('../landing/src/App.tsx');
  const styles = read('../landing/src/styles.css');
  const main = read('../landing/src/main.tsx');

  assert.match(app, /scratchpad-active-list\.webp/);
  assert.match(app, /scratchpad-edit-job\.webp/);
  assert.match(styles, /\.screenshots \{[^}]*align-items: end;/s);
  assert.match(styles, /@sangeev\/estate-ui\/contract\.css/);
  assert.match(app, /PublicEstateHeader/);
  assert.match(app, /useEstateTheme/);
  assert.match(main, /initialiseEstateTheme\(\)/);
});
