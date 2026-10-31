// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { defineOwnToString, isXtermModule, xtermFrozenPrototype } from './xtermFrozenPrototype';

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

describe('the xterm bundle under a frozen Object.prototype', () => {
  it('throws on the namespace assignment xterm ships', () => {
    expect(() => runInNewContext(`'use strict';${FREEZE}${NAMESPACE}`)).toThrow(
      /read only property 'toString'/,
    );
  });

  it('runs once the assignment defines an own property', () => {
    const code = defineOwnToString({ code: NAMESPACE });
    const namespace = runInNewContext(`'use strict';${FREEZE}${code}`) as {
      toString: (value: string) => string;
      fromString: (value: string) => string;
    };
    expect(namespace.toString('ctrl')).toBe('ctrl');
    expect(namespace.fromString('alt')).toBe('alt');
  });

  it.each(SHIPPED)('leaves no toString assignment in %s', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toMatch(/\.toString=[A-Za-z_$]+[;,}]/);
    const patched = defineOwnToString({ code: source });
    expect(patched).not.toMatch(/\.toString=[A-Za-z_$]+[;,}]/);
    expect(patched).toContain('Object.defineProperty(');
  });

  it('transforms only xterm modules', () => {
    const plugin = xtermFrozenPrototype();
    const transform = plugin.transform as (code: string, id: string) => unknown;
    expect(isXtermModule({ id: SHIPPED[0] ?? '' })).toBe(true);
    expect(transform(NAMESPACE, '/repo/src/other.ts')).toBeNull();
    expect(transform(NAMESPACE, SHIPPED[0] ?? '')).not.toBeNull();
  });
});
