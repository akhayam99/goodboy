const STRING_LITERAL = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

const SWALLOWED_CATCH = /\.catch\(\s*\(\)\s*=>\s*(?:undefined|null|\{\s*\})[\s,]*\)/g;

const AMBIENT_KEY = /\b(?:currentWorkspaceId|diffMountPath)\s*:/g;

const AMBIENT_READ =
  /\b(?:currentWorkspaceId|diffMountPath)\b|\b(?:resolveActiveMountPath|activeMountPath|selectActiveMount|selectActiveMountId|selectDisplayedMount)\(/;

const SLICES_ROOT = 'apps/desktop/src/store/slices/';

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
  if (!path.startsWith(SLICES_ROOT)) {
    return 0;
  }
  return text.split('\n').filter((line) => isAmbientLine({ line })).length;
};
