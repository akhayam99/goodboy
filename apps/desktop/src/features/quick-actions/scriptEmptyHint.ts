import type { SessionScriptGroup } from '../scripts/buildSessionScripts';

type NamesParams = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
};

const projectNames = ({ groups }: NamesParams): string => {
  const names = [...new Set(groups.map((group) => group.projectName))];
  const last = names.pop();
  if (last === undefined) {
    return '';
  }
  return names.length === 0 ? last : `${names.join(', ')} or ${last}`;
};

type Params = {
  readonly groups: ReadonlyArray<SessionScriptGroup>;
  readonly query: string;
  readonly isReading: boolean;
};

export const scriptEmptyHint = ({ groups, query, isReading }: Params): string => {
  if (groups.length === 0) {
    return 'Add a project to this session to run its scripts.';
  }
  const ready = groups.filter((group) => group.isReady);
  if (ready.some((group) => group.scripts.length > 0)) {
    return `No scripts match "${query}".`;
  }
  if (ready.length === 0) {
    return groups.length === 1
      ? `${projectNames({ groups })} is still preparing.`
      : 'These projects are still preparing.';
  }
  if (isReading) {
    return `Reading scripts in ${projectNames({ groups: ready })}.`;
  }
  return `No scripts in ${projectNames({ groups: ready })}. Save one in Scripts.`;
};
