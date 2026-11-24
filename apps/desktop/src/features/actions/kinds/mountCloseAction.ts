import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/utils/names';
import type { ActionDefinition } from '../types';
import { closeMountKeepingFolder } from './closeMountKeepingFolder';
import { hasWorkOnlyInFolderOf } from './hasWorkOnlyInFolderOf';
import { mountCloseConfirm } from './mountCloseConfirm';
import type { MountFacts } from './mountFacts';

export const MOUNT_CLOSE_ACTION: ActionDefinition<MountFacts> = {
  id: 'mount.close',
  label: NAMES.closeBranch,
  icon: CONCEPT_ICONS.worktree,
  group: 'danger',
  when: ({ facts }) => !facts.isClosed && facts.worktreePath !== null && !facts.isRebasing,
  slot: () => 'menu',
  placement: ({ facts }) => (facts.pr === 'merged' ? 'palette' : 'everywhere'),
  pendingLabel: () => NAMES.closing,
  confirm: mountCloseConfirm,
  run: async ({ facts, env }) => {
    if (hasWorkOnlyInFolderOf({ facts })) {
      await closeMountKeepingFolder({ facts, env });
      return;
    }
    if (facts.pr === 'merged') {
      const result = await env.getState().removeMountWorktree({
        sessionId: facts.sessionId,
        mountId: facts.mountId,
        mode: 'safe',
      });
      if (result.kind === 'kept' || result.kind === 'failed') {
        throw new Error(result.reason ?? `The worktree for ${facts.label} stayed.`);
      }
      return;
    }
    await env.getState().unmountMount({
      sessionId: facts.sessionId,
      mountId: facts.mountId,
      onKeptFolder: facts.pinnedRunIds.length > 0 ? 'detach' : 'refuse',
    });
  },
};
