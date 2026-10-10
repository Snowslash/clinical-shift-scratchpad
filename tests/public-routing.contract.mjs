import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('unknown routes have a standalone 404 document, not a landing or SPA fallback', () => {
  const file = new URL('../landing/public/404.html', import.meta.url);
  assert.ok(existsSync(file), '404 document must disable implicit SPA fallback');
  const html = readFileSync(file, 'utf8');
  assert.match(html, /<html lang="en-GB">/);
  assert.match(html, /<h1>Page not found<\/h1>/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /id="root"|<script|http-equiv="refresh"|rel="canonical"/);
});
