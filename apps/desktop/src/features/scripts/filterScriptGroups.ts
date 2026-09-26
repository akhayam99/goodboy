import type { SessionScriptGroup } from './buildSessionScripts';

type Params = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly query: string;
};

export const filterScriptGroups = ({
  groups,
  query,
}: Params): ReadonlyArray<SessionScriptGroup> => {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') {
    return groups;
  }
  return groups.flatMap((group) => {
    const isProjectMatch = group.projectName.toLocaleLowerCase().includes(needle);
    const scripts = isProjectMatch
      ? group.scripts
      : group.scripts.filter((script) =>
          [script.name, script.command, script.packageName, script.relDir].some((field) =>
            field.toLocaleLowerCase().includes(needle),
          ),
        );
    return scripts.length === 0 ? [] : [{ ...group, scripts }];
  });
};
