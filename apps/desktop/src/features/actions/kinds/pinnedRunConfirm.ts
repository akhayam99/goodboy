import { PINNED_RUN_COPY } from '../../workflows/pinnedRunCopy';
import type { ActionConfirm } from '../types';
import { plural } from './gitRuns';
import type { MountFacts } from './mountFacts';

type Params = { readonly facts: MountFacts };

export const pinnedRunConfirm = ({ facts }: Params): ActionConfirm => {
  const warning = PINNED_RUN_COPY.warning({
    label: facts.pinnedRunLabel ?? '',
    count: facts.pinnedRunIds.length,
  });
  const kept = plural({
    count: facts.dirty,
    one: 'uncommitted change',
    many: 'uncommitted changes',
  });
  return {
    title: `Detach ${facts.label}?`,
    description: facts.dirty > 0 ? `${warning} The ${kept} stay on disk.` : warning,
    confirmLabel: PINNED_RUN_COPY.detachAnyway,
    role: 'alert',
    altActionId: 'mount.stopPinnedRun',
    altLabel: PINNED_RUN_COPY.stopRunFirst,
  };
};
