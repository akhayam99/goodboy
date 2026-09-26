import type { ScriptPackageSection } from './groupScriptsByPackage';

const CLOSE_BEYOND_PACKAGE_COUNT = 6;

const isSameDay = ({ a, b }: { readonly a: number; readonly b: number }): boolean => {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
};

type Params = {
  readonly sections: ReadonlyArray<ScriptPackageSection>;
  readonly packageCount: number;
  readonly runningKeys: ReadonlySet<string>;
  readonly startedAtByKey: Readonly<Record<string, number>>;
  readonly now: number;
};

export const defaultClosedPackageKeys = ({
  sections,
  packageCount,
  runningKeys,
  startedAtByKey,
  now,
}: Params): ReadonlySet<string> => {
  if (packageCount <= CLOSE_BEYOND_PACKAGE_COUNT) {
    return new Set();
  }
  const closed = new Set<string>();
  for (const section of sections) {
    if (section.source === 'saved' || section.relDir === '') {
      continue;
    }
    const hasActivity = section.scripts.some((script) => {
      if (runningKeys.has(script.key)) {
        return true;
      }
      const startedAt = startedAtByKey[script.key];
      return startedAt !== undefined && isSameDay({ a: startedAt, b: now });
    });
    if (!hasActivity) {
      closed.add(section.key);
    }
  }
  return closed;
};
