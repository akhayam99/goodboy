// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { xtermFrozenPrototype } from './xtermFrozenPrototype';

const NAMESPACE =
  'var Qn;(o=>{function s(l){return l}o.toString=s;function t(l){return l}o.fromString=t})(Qn||={});Qn';

const FREEZE = 'Object.freeze(Object.prototype);';

const require = createRequire(import.meta.url);

type PackageParams = {
  readonly name: string;
  readonly file: string;
};

const packageFile = ({ name, file }: PackageParams): string =>
  join(dirname(require.resolve(`${name}/package.json`)), file);

const SHIPPED = [
  packageFile({ name: '@xterm/xterm', file: 'lib/xterm.mjs' }),
  packageFile({ name: '@xterm/addon-webgl', file: 'lib/addon-webgl.mjs' }),
];

const XTERM_ID = '/repo/node_modules/@xterm/xterm/lib/xterm.mjs';

const plugin = xtermFrozenPrototype();

type TransformParams = {
  readonly code: string;
  readonly id?: string;
};

const patch = ({ code, id = XTERM_ID }: TransformParams): string | null => {
  const transform = plugin.transform as (code: string, id: string) => { code: string } | null;
  return transform(code, id)?.code ?? null;
};

const runFrozen = ({ code }: TransformParams): unknown =>
  runInNewContext(`'use strict';${FREEZE}${code}`);

describe('the xterm bundle under a frozen Object.prototype', () => {
  it('throws on the namespace assignment xterm ships', () => {
    expect(() => runFrozen({ code: NAMESPACE })).toThrow(/read only property 'toString'/);
  });

  it('runs once the assignment defines an own property', () => {
    const namespace = runFrozen({ code: patch({ code: NAMESPACE }) ?? '' }) as {
      toString: (value: string) => string;
      fromString: (value: string) => string;
    };
    expect(namespace.toString('ctrl')).toBe('ctrl');
    expect(namespace.fromString('alt')).toBe('alt');
  });

  it('rewrites the minified and the unminified assignment', () => {
    expect(patch({ code: 'o.toString=s;' })).toBe(
      'Object.defineProperty(o,"toString",{value:s,writable:true,configurable:true,enumerable:true});',
    );
    expect(patch({ code: 'KeyCombo.toString = toString;' })).toBe(
      'Object.defineProperty(KeyCombo,"toString",{value:toString,writable:true,configurable:true,enumerable:true});',
    );
  });

  it('keeps the target whole when its name starts with a dollar sign or ends a member chain', () => {
    expect(patch({ code: '$e.toString=s;' })).toBe(
      'Object.defineProperty($e,"toString",{value:s,writable:true,configurable:true,enumerable:true});',
    );
    expect(patch({ code: 'a.b.toString=s;' })).toBe(
      'Object.defineProperty(a.b,"toString",{value:s,writable:true,configurable:true,enumerable:true});',
    );
    expect(patch({ code: 'a$.b_.toString=s,' })).toContain('Object.defineProperty(a$.b_,');
  });

  it('runs a member chain under a frozen prototype', () => {
    const code = patch({
      code: 'var a={b:{}};function s(){return 7}a.b.toString=s;a.b.toString()',
    });
    expect(runFrozen({ code: code ?? '' })).toBe(7);
  });

  it('leaves other assignments alone', () => {
    expect(patch({ code: 'o.toStringTag=s;x.toString=function(){};y.toString=s+1;' })).toBeNull();
    expect(patch({ code: 'o.valueOf=s;' })).toBeNull();
  });

  it.each(SHIPPED)('leaves no toString assignment in %s', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toMatch(/\.toString=[A-Za-z_$]+[;,}]/);
    const patched = patch({ code: source, id: file });
    expect(patched).not.toBeNull();
    expect(patched).not.toMatch(/\.toString=[A-Za-z_$]+[;,}]/);
    expect(patched).toContain('Object.defineProperty(');
  });

  it('transforms only xterm modules', () => {
    expect(patch({ code: NAMESPACE, id: '/repo/src/other.ts' })).toBeNull();
    expect(patch({ code: NAMESPACE, id: SHIPPED[0] ?? '' })).not.toBeNull();
  });
});

describe('the xterm bundle in a dev server', () => {
  it('keeps every @xterm dependency out of the pre-bundle so the transform sees its code', () => {
    const config = plugin.config as () => { optimizeDeps: { exclude: ReadonlyArray<string> } };
    const manifest = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));
    const declared = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })
      .filter((name) => name.startsWith('@xterm/'))
      .sort();
    expect(declared.length).toBeGreaterThan(0);
    expect([...config().optimizeDeps.exclude].sort()).toEqual(declared);
  });

  it('patches an excluded package served from node_modules with a version query', () => {
    expect(patch({ code: NAMESPACE, id: `${XTERM_ID}?v=4a1f9c2e` })).not.toBeNull();
  });
});
