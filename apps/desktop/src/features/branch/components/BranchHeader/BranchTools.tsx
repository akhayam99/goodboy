import { Plus } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openBranchBrowser } from '../../../browser/openBranchBrowser';
import { openStartRun } from '../../../session/startRun/openStartRun';
import { openBranchTerminal } from '../../../terminal/openBranchTerminal';
import { useBranchIdentity } from '../../hooks/useBranchIdentity';

type Props = {
  readonly sessionId: SessionId;
  readonly canStartRun: boolean;
};

export const BranchTools = ({ sessionId, canStartRun }: Props) => {
  const { mountPath, mount } = useBranchIdentity({ sessionId });
  return (
    <div data-slot="branch-tools" className="flex shrink-0 items-center gap-1">
      {canStartRun ? (
        <IconButton
          icon={Plus}
          label="Start a run on this branch"
          onClick={() => openStartRun({ sessionId, branch: mount?.branch ?? null })}
        />
      ) : null}
      <IconButton
        icon={CONCEPT_ICONS.terminal}
        label="Open a terminal here"
        tooltip="Open a terminal in this branch's folder"
        onClick={() => openBranchTerminal({ sessionId, mountPath })}
      />
      <IconButton
        icon={CONCEPT_ICONS.browser}
        label="Open the browser here"
        tooltip="Open the browser beside this branch"
        onClick={() => openBranchBrowser({ sessionId })}
      />
    </div>
  );
};
