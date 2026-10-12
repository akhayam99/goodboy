type Params = { readonly path: string };

const LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lockb',
]);

export const definitionOfScope = ({ path }: Params): 'project' | 'dependency' => {
  const parts = path.split('/');
  const name = parts.at(-1) ?? '';
  if (
    parts.includes('node_modules') ||
    parts.includes('vendor') ||
    name.endsWith('.lock') ||
    LOCKFILES.has(name)
  ) {
    return 'dependency';
  }
  return 'project';
};
