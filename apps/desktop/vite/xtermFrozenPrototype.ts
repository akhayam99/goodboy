import type { Plugin } from 'vite';

const XTERM_PLUGIN_NAME = 'goodboy-xterm-frozen-prototype';

const XTERM_MODULE = /[\\/]@xterm[\\/+]/;

const TO_STRING_ASSIGNMENT = /\b([A-Za-z_$][\w$]*)\.toString=([A-Za-z_$][\w$]*)(?=[;,}])/g;

const OWN_TO_STRING =
  'Object.defineProperty($1,"toString",{value:$2,writable:true,configurable:true,enumerable:true})';

type CodeParams = {
  readonly code: string;
};

type IdParams = {
  readonly id: string;
};

export const isXtermModule = ({ id }: IdParams): boolean => XTERM_MODULE.test(id);

export const defineOwnToString = ({ code }: CodeParams): string =>
  code.replace(TO_STRING_ASSIGNMENT, OWN_TO_STRING);

export const xtermFrozenPrototype = (): Plugin => ({
  name: XTERM_PLUGIN_NAME,
  enforce: 'pre',
  transform: (code, id) => {
    if (!isXtermModule({ id })) {
      return null;
    }
    const patched = defineOwnToString({ code });
    return patched === code ? null : { code: patched, map: null };
  },
});
