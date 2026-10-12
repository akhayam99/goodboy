import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { NextStepRow } from '../../../../../features/suggestions/components/NextStepSlot/NextStepRow';
import type { SessionSuggestion } from '../../../../../features/suggestions/types';
import type { SuggestionActions } from '../../../../../features/suggestions/useSuggestionActions';

const SESSION_ID: SessionId = JSON.parse(JSON.stringify('mock-u25-history-session'));

const MOUNT_ID: MountId = JSON.parse(JSON.stringify('mock-u25-history-mount'));
const PROJECT_ID: ProjectId = JSON.parse(JSON.stringify('mock-u25-history-project'));

const SUGGESTION: SessionSuggestion = {
  id: 'rebase-project:mock-u25-history-session',
  kind: 'rebase-project',
  priority: 30,
  band: 2,
  title: 'Rebase payments-api on main',
  detail: '18 commits behind',
  sessionId: SESSION_ID,
  fingerprint: 'rebase-project:mock-u25-history-session:18',
  targetKey: null,
  payload: {
    targets: [
      {
        id: 'mount:mock-u25-history-mount',
        mountId: MOUNT_ID,
        projectId: PROJECT_ID,
        projectName: 'payments-api',
        branch: 'hl/fix-duplicate-credit',
        worktreePath: '~/code/harborline/payments-api',
        baseBranch: 'main',
        behind: 18,
        dirtyCount: 0,
      },
    ],
  },
};

const idleActions = (): SuggestionActions => ({
  primary: {
    label: 'Rebase',
    isDisabled: false,
    failureTitle: "Couldn't rebase",
    run: async () => undefined,
  },
  onDismiss: null,
});

const busyActions = (): SuggestionActions => ({
  primary: {
    label: 'Rebasing',
    isDisabled: true,
    isBusy: true,
    failureTitle: "Couldn't rebase",
    run: async () => undefined,
  },
  onDismiss: null,
});

export const NextStepRebaseScene = () => {
  const isBusy = new URLSearchParams(window.location.search).get('state') === 'busy';
  return (
    <div className="mx-auto flex w-[640px] max-w-full flex-col p-6">
      <NextStepRow
        suggestion={SUGGESTION}
        actions={isBusy ? busyActions() : idleActions()}
        compact={false}
        isPending={false}
        onNotNow={() => undefined}
      />
    </div>
  );
};
