// Source and emitted fallback checks. No browser or new dependencies required.
import { readFileSync, existsSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const expected = JSON.parse(read('tests/landing-copy.fixture.json'));
const context = { exports: {} };
vm.runInNewContext(stripTypeScriptTypes(read(expected.config)).replace(/export const project\s*=/, 'exports.project ='), context);
const project = JSON.parse(JSON.stringify(context.exports.project));
test('reviewed description, boundaries and destinations remain literal', () => {
  for (const key of ['key', 'name', 'description', 'sourceHref', 'beforeYouUse', 'limits', 'actions', 'actionNote']) {
    assert.deepEqual(project[key], expected[key], key);
  }
  const publicDir = expected.html.startsWith('landing/') ? 'landing/public' : 'public';
  for (const shot of project.shots) assert.ok(existsSync(path.join(root, publicDir, shot.src.replace(/^\.?\//, ''))), shot.src);
});
const files = [expected.html];
if (process.env.LANDING_BUILT) files.push(...process.env.LANDING_BUILT.split(',').map(dir => `${dir}/index.html`));
for (const file of files) test(`${file}: initial HTML retains useful copy and real destinations without JavaScript`, () => {
  const html = read(file).split(/<body[^>]*>/i)[1].split('</body>')[0].replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  for (const line of [expected.name, expected.description, ...expected.beforeYouUse, expected.limits, ...(expected.actionNote ? [expected.actionNote] : [])]) assert.ok(text.includes(line), line);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<main\b/);
  for (const href of [expected.sourceHref, `https://sangeev.me/#${expected.key}`, ...expected.actions.map(action => action.href)]) assert.ok(html.includes(`href="${href}"`), href);
  if (!expected.actions.length) assert.ok(!html.includes('href="./app/"'), 'phone-only source page must not invent a web app');
});
