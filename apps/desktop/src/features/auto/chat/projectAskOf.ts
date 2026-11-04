import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AGENT_KIND_META, kindForRole } from '../../session/agent-kind';

export type ProjectAskMount = Readonly<{
  project: string;
  branch: string | null;
  reason: string;
}>;

export type ProjectAsk = Readonly<{
  key: string;
  roleNoun: string;
  mount: ProjectAskMount | null;
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
  const note = refusal.mount;
  const mount: ProjectAskMount | null =
    note === undefined || note.state !== 'ask'
      ? null
      : { project: note.project, branch: note.branch, reason: note.reason };
  return {
    key: `${view.tree.id}:${view.tree.generation}:${refusal.code}:${refusal.roles.join(',')}:${mount?.project ?? ''}`,
    roleNoun,
    mount,
  };
};
