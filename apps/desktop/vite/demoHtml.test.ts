// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoPlugins, withDemoHead } from './demoHtml';

const INSIGHTS_SRC = '/_vercel/insights/script.js';

const INDEX_HTML = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

describe('the demo html', () => {
  it('adds the cookieless Web Analytics script and a theme script to the head', () => {
    const html = withDemoHead({ html: INDEX_HTML });
    expect(html).toContain(`<script defer src="${INSIGHTS_SRC}"></script>`);
    expect(html.indexOf(INSIGHTS_SRC)).toBeLessThan(html.indexOf('</head>'));
    expect(html).toContain("localStorage.getItem('goodboy-demo-theme')");
  });

  it('adds the script once', () => {
    const once = withDemoHead({ html: INDEX_HTML });
    expect(withDemoHead({ html: once })).toBe(once);
  });

  it('only runs in a build', () => {
    expect(demoPlugins({ mode: 'demo' }).map((plugin) => plugin.apply)).toEqual(['build']);
  });

  it('leaves the html the desktop app ships without analytics', () => {
    expect(INDEX_HTML).not.toContain('_vercel');
    expect(INDEX_HTML).not.toContain('goodboy-demo-theme');
  });
});

describe('the demo plugins', () => {
  it('are on in the demo mode only', () => {
    expect(demoPlugins({ mode: 'demo' }).map((plugin) => plugin.name)).toEqual([
      'goodboy-demo-html',
    ]);
    expect(demoPlugins({ mode: 'production' })).toEqual([]);
    expect(demoPlugins({ mode: 'development' })).toEqual([]);
  });
});
