import type { SessionScriptGroup } from './buildSessionScripts';

type Params = {
  readonly group: Pick<SessionScriptGroup, 'projectName' | 'branch'>;
};

export const scriptGroupScopeOf = ({ group }: Params): string =>
  group.branch === '' ? group.projectName : `${group.projectName} · ${group.branch}`;
