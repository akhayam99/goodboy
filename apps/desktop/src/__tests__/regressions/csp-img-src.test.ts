// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const DESKTOP = join(__dirname, '..', '..', '..');

type TauriConfig = { readonly app: { readonly security: { readonly csp: string } } };

const readCsp = (): string => {
  const config: TauriConfig = JSON.parse(
    readFileSync(join(DESKTOP, 'src-tauri', 'tauri.conf.json'), 'utf8'),
  );
  return config.app.security.csp;
};

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
});
