export const OLD_ENTRY_POINTS: ReadonlyArray<string> = [
  'resolveRoleRouting',
  'autoModelForRole',
  'recommendedModelForRole',
  'resolveTaskModel',
  'resolveAuto',
  'resolveLimitedTaskModel',
];

const NAMED_LIST = /(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;

type Params = {
  readonly text: string;
};

export const countOldEntryPointImports = ({ text }: Params): number =>
  Array.from(text.matchAll(NAMED_LIST)).reduce((total, match) => {
    const names = (match[1] ?? '').split(',').map(
      (part) =>
        part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          ?.trim() ?? '',
    );
    return total + names.filter((name) => OLD_ENTRY_POINTS.includes(name)).length;
  }, 0);
