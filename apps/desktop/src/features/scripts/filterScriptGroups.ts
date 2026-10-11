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
    const matches = (script: SessionScriptGroup['scripts'][number]): boolean =>
      isProjectMatch ||
      [script.name, script.body, script.packageName, script.relDir].some((field) =>
        field.toLocaleLowerCase().includes(needle),
      );
    const scripts = group.scripts.filter(matches);
    const suggested = group.suggested.filter(matches);
    return scripts.length === 0 && suggested.length === 0 ? [] : [{ ...group, scripts, suggested }];
  });
};
