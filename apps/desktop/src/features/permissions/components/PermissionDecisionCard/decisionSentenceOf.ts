import type { PermissionScope } from '@goodboy/types';

type Params = {
  readonly decision: 'allow' | 'deny';
  readonly scope: PermissionScope | undefined;
  readonly toolName: string;
  readonly subject: string | null;
};

const RULE_PLACE: Readonly<Record<'session' | 'workspace' | 'project' | 'global', string>> = {
  session: 'in this session',
  workspace: 'in this workspace',
  project: 'in this project',
  global: 'in every workspace',
};

export const decisionSentenceOf = ({ decision, scope, toolName, subject }: Params): string => {
  const verb = decision === 'allow' ? 'Allowed' : 'Denied';
  const what = subject ?? toolName;
  if (scope === 'once') {
    return `${verb} ${what} for this call`;
  }
  if (scope === 'deny') {
    return `${verb} ${toolName} for the rest of this session`;
  }
  if (scope === 'session' || scope === 'workspace' || scope === 'project' || scope === 'global') {
    return `${verb} ${toolName} ${RULE_PLACE[scope]}`;
  }
  return `${verb} ${what}`;
};
