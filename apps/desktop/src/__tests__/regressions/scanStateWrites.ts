const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const SWALLOWED_CATCH = /\.catch\(\s*\(\)\s*=>\s*(?:undefined|null|\{\s*\})[\s,]*\)/g;

const AMBIENT_KEY = /\b(?:currentWorkspaceId|diffMountPath)\s*:/g;

const AMBIENT_READ =
  /\b(?:currentWorkspaceId|diffMountPath)\b|\b(?:resolveActiveMountPath|activeMountPath|selectActiveMount|selectActiveMountId|selectDisplayedMount)\(/;

const STORE_WRITE_ROOTS: ReadonlyArray<string> = [
  'apps/desktop/src/store/slices/',
  'apps/desktop/src/store/runtime/',
];

export const countSwallowedCatches = ({ text }: { readonly text: string }): number =>
  (text.match(SWALLOWED_CATCH) ?? []).length;

const isAmbientLine = ({ line }: { readonly line: string }): boolean => {
  const trimmed = line.trim();
  if (trimmed.startsWith('import ') || trimmed.startsWith('readonly ')) {
    return false;
  }
  const bare = line.replace(STRING_LITERAL, '""').replace(AMBIENT_KEY, '');
  return AMBIENT_READ.test(bare);
};

type AmbientParams = {
  readonly path: string;
  readonly text: string;
};

export const countAmbientReads = ({ path, text }: AmbientParams): number => {
  if (!STORE_WRITE_ROOTS.some((root) => path.startsWith(root))) {
    return 0;
  }
  return text.split('\n').filter((line) => isAmbientLine({ line })).length;
};

const SESSION_AMBIENT_KEY = /\b(?:currentSessionId|selectedAgentId|activeProjectId)\s*:/g;

const SESSION_AMBIENT_READ = /\b(?:currentSessionId|selectedAgentId|activeProjectId)\b/;

const isSessionAmbientLine = ({ line }: { readonly line: string }): boolean => {
  const trimmed = line.trim();
  if (trimmed.startsWith('import ') || trimmed.startsWith('readonly ')) {
    return false;
  }
  const bare = line.replace(STRING_LITERAL, '""').replace(SESSION_AMBIENT_KEY, '');
  return SESSION_AMBIENT_READ.test(bare);
};

const isStoreWritePath = ({ path }: { readonly path: string }): boolean =>
  STORE_WRITE_ROOTS.some((root) => path.startsWith(root));

export const countSessionAmbientReads = ({ path, text }: AmbientParams): number => {
  if (!isStoreWritePath({ path })) {
    return 0;
  }
  return text.split('\n').filter((line) => isSessionAmbientLine({ line })).length;
};

const SET_CALL = /(?<![\w.])set\s*\(/;

const AWAIT_EXPRESSION = /\bawait\b/;

export const hasSetBeforeAwait = ({ path, text }: AmbientParams): boolean => {
  if (!isStoreWritePath({ path })) {
    return false;
  }
  const bare = text.replace(STRING_LITERAL, '""');
  const setAt = bare.search(SET_CALL);
  const awaitAt = bare.search(AWAIT_EXPRESSION);
  return setAt !== -1 && awaitAt !== -1 && setAt < awaitAt;
};

const OPTIONAL_MOUNT = /\bmountId\s*\?\s*:/g;

export const countOptionalMountParams = ({ path, text }: AmbientParams): number => {
  if (!isStoreWritePath({ path })) {
    return 0;
  }
  return (text.match(OPTIONAL_MOUNT) ?? []).length;
};

const CATCH_THEN_RETURN = /\bcatch(?:\s*\([^)]*\))?\s*\{\s*return\b[^;{}]*(?:;[^{}]*)?\}/g;

export const countCatchReturns = ({ path, text }: AmbientParams): number => {
  if (!isStoreWritePath({ path })) {
    return 0;
  }
  return (text.match(CATCH_THEN_RETURN) ?? []).length;
};
