import type { Plugin } from 'vite';

const XTERM_PLUGIN_NAME = 'goodboy-xterm-frozen-prototype';

const XTERM_MODULE = /[\\/]@xterm[\\/+]/;

const XTERM_PACKAGES: ReadonlyArray<string> = [
  '@xterm/xterm',
  '@xterm/addon-clipboard',
  '@xterm/addon-fit',
  '@xterm/addon-search',
  '@xterm/addon-unicode11',
  '@xterm/addon-web-links',
  '@xterm/addon-webgl',
];

const TO_STRING_ASSIGNMENT =
  /(?<![\w$.])((?:[A-Za-z_$][\w$]*\.)*[A-Za-z_$][\w$]*)\.toString\s*=\s*([A-Za-z_$][\w$]*)(?=\s*[;,}])/g;

const OWN_TO_STRING =
  'Object.defineProperty($1,"toString",{value:$2,writable:true,configurable:true,enumerable:true})';

export const xtermFrozenPrototype = (): Plugin => ({
  name: XTERM_PLUGIN_NAME,
  enforce: 'pre',
  config: () => ({ optimizeDeps: { exclude: [...XTERM_PACKAGES] } }),
  transform: (code, id) => {
    if (!XTERM_MODULE.test(id)) {
      return null;
    }
    const patched = code.replace(TO_STRING_ASSIGNMENT, OWN_TO_STRING);
    return patched === code ? null : { code: patched, map: null };
  },
});
