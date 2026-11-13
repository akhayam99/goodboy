// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP = join(__dirname, '..', '..', '..');

type TauriConfig = {
  readonly app: {
    readonly security: { readonly csp: string; readonly freezePrototype?: unknown };
  };
};

const readConfig = (): TauriConfig =>
  JSON.parse(readFileSync(join(DESKTOP, 'src-tauri', 'tauri.conf.json'), 'utf8'));

const readCsp = (): string => readConfig().app.security.csp;

type DirectiveParams = {
  readonly csp: string;
  readonly name: string;
};

const directive = ({ csp, name }: DirectiveParams) =>
  csp
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find((tokens) => tokens[0] === name)
    ?.slice(1);

describe('the app content security policy', () => {
  it('admits the page, data urls and blob urls for images and nothing remote', () => {
    expect(directive({ csp: readCsp(), name: 'img-src' })).toEqual(["'self'", 'data:', 'blob:']);
  });

  it('admits blob urls for media and nothing else', () => {
    expect(directive({ csp: readCsp(), name: 'media-src' })).toEqual(['blob:']);
  });

  it('leaves the other directives closed', () => {
    const csp = readCsp();
    expect(directive({ csp, name: 'default-src' })).toEqual(["'self'"]);
    expect(directive({ csp, name: 'script-src' })).toEqual(["'self'"]);
    expect(directive({ csp, name: 'connect-src' })).toEqual([
      "'self'",
      'ipc:',
      'http://ipc.localhost',
    ]);
    expect(directive({ csp, name: 'frame-src' })).toEqual(['gbframe:', 'http://gbframe.localhost']);
  });

  it('forbids a base tag and a form post', () => {
    const csp = readCsp();
    expect(directive({ csp, name: 'base-uri' })).toEqual(["'none'"]);
    expect(directive({ csp, name: 'form-action' })).toEqual(["'none'"]);
  });

  it('leaves browser tabs unfrozen and freezes the app document before any app script', () => {
    expect(readConfig().app.security.freezePrototype).toBe(false);
    const html = readFileSync(join(DESKTOP, 'index.html'), 'utf8');
    const lower = html.toLowerCase();
    const firstScript = lower.indexOf('<script');
    expect(firstScript).toBeGreaterThan(-1);
    expect(html.slice(firstScript, lower.indexOf('>', firstScript) + 1)).toBe(
      '<script src="/freeze-prototype.js">',
    );
    expect(readFileSync(join(DESKTOP, 'public', 'freeze-prototype.js'), 'utf8').trim()).toBe(
      'Object.freeze(Object.prototype);',
    );
  });

  it('lets no page frame the app, so a browser tab cannot embed it', () => {
    expect(directive({ csp: readCsp(), name: 'frame-ancestors' })).toEqual(["'none'"]);
  });

  it('never admits a data url or a blob url as a frame source', () => {
    expect(directive({ csp: readCsp(), name: 'frame-src' })).not.toContain('data:');
    expect(directive({ csp: readCsp(), name: 'frame-src' })).not.toContain('blob:');
  });
});
