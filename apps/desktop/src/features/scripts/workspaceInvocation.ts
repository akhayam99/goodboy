type Params = {
  readonly manager: string;
  readonly packageName: string;
  readonly relDir: string;
  readonly name: string;
};

export const workspaceInvocation = ({ manager, packageName, relDir, name }: Params): string => {
  if (relDir === '') {
    return manager === 'composer' ? `composer run-script ${name}` : `${manager} run ${name}`;
  }
  switch (manager) {
    case 'yarn':
      return `yarn workspace ${packageName} run ${name}`;
    case 'pnpm':
      return `pnpm --filter ${packageName} run ${name}`;
    case 'npm':
      return `npm run ${name} --workspace ${relDir}`;
    case 'bun':
      return `bun run --filter ${packageName} ${name}`;
    case 'composer':
      return `composer run-script ${name} -d ${relDir}`;
    default:
      return `${manager} run ${name}`;
  }
};
