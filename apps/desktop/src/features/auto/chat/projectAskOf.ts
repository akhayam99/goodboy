import { parseAutoDelegationRole } from '@goodboy/core';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AGENT_KIND_META, kindForRole } from '../../session/agent-kind';

export type ProjectAsk = Readonly<{
  key: string;
  roleNoun: string;
}>;

const MOUNT_CODES: ReadonlySet<string> = new Set(['mount_ambiguous', 'mount_missing']);

type Params = {
  readonly view: AutoTreeView;
};

export const projectAskOf = ({ view }: Params): ProjectAsk | null => {
  const refusal = view.pendingRefusal;
  if (refusal === null || !MOUNT_CODES.has(refusal.code)) {
    return null;
  }
  const role = refusal.roles
    .map((value) => parseAutoDelegationRole({ role: value }))
    .find((parsed) => parsed !== null);
  const roleNoun =
    role === undefined || role === null ? 'agent' : AGENT_KIND_META[kindForRole({ role })].noun;
  return {
    key: `${view.tree.id}:${view.tree.generation}:${refusal.code}:${refusal.roles.join(',')}`,
    roleNoun,
  };
};
