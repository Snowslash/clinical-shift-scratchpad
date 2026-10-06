import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import App from '../landing/src/App';

test('public brochure renders only Projects and GitHub navigation with shared brand and theme control', () => {
  const html = renderToStaticMarkup(createElement(App));
  const header = html.match(/<header\b[\s\S]*?<\/header>/)![0];
  const nav = header.match(/<nav\b[\s\S]*?<\/nav>/)![0];
  const anchors = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
  expect(anchors.map(([, attrs, content]) => ({
    label: attrs.match(/aria-label="([^"]+)"/)?.[1] ?? content,
    href: attrs.match(/href="([^"]+)"/)?.[1],
  }))).toEqual([
    { label: 'Projects', href: 'https://sangeev.me/#projects' },
    { label: 'GitHub', href: 'https://github.com/Snowslash' },
  ]);
  expect(header).toContain('class="estate-wordmark" href="https://sangeev.me"');
  expect(header).toContain('Sangeev<span class="estate-wordmark__suffix">.me</span>');
  expect(header).toContain('aria-label="Switch to light mode"');
  expect(header).toContain('class="estate-theme-toggle"');
});
