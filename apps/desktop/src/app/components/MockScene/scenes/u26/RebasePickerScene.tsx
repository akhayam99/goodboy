import { useEffect, useState } from 'react';
import { NextStepRow } from '../../../../../features/suggestions/components/NextStepSlot/NextStepRow';
import type {
  RebaseSuggestionTarget,
  SessionSuggestion,
} from '../../../../../features/suggestions/types';
import type { SuggestionActions } from '../../../../../features/suggestions/useSuggestionActions';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useSceneClicks } from '../audit/useSceneClicks';
import { SESSION_ID, seedResolveScene } from '../resolveSeed';
import { REBASE_ALL_MOUNTS } from './rebaseSeed';

type Props = {
  readonly theme: 'dark' | 'light';
};

const BEHIND = [9, 6, 3];

const TARGETS: ReadonlyArray<RebaseSuggestionTarget> = REBASE_ALL_MOUNTS.map((mount, index) => ({
  id: `mount:${mount.mountId}`,
  mountId: mount.mountId,
  projectId: mount.projectId,
  projectName: mount.mountName,
  branch: mount.branch,
  worktreePath: mount.worktreePath,
  baseBranch: 'main',
  behind: BEHIND[index] ?? 1,
  dirtyCount: 0,
}));

const SUGGESTION: SessionSuggestion = {
  id: `rebase-project:${SESSION_ID}`,
  kind: 'rebase-project',
  priority: 40,
  band: 2,
  title: `Rebase ${TARGETS.length} branches`,
  detail: `${TARGETS.length} folders behind`,
  sessionId: SESSION_ID,
  fingerprint: `rebase-project:${SESSION_ID}:u26`,
  targetKey: null,
  payload: { targets: TARGETS },
};

const ACTIONS: SuggestionActions = {
  primary: {
    label: 'Choose branches to rebase',
    shortLabel: 'Rebase',
    isDisabled: false,
    failureTitle: "Couldn't rebase the branch",
    shouldOpenPicker: true,
    run: async () => undefined,
  },
  onDismiss: null,
};

const CLICK_MS = 300;

export const RebasePickerScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedResolveScene({ expandedThreadId: null });
    setIsReady(true);
  }, [theme]);
  useSceneClicks({
    isReady,
    labels: ['Rebase'],
    selector: '[data-column="primary"] button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });
  if (!isReady) {
    return null;
  }
  return (
    <div data-shot className="mx-auto flex w-[640px] max-w-full flex-col gap-2 p-6">
      <NextStepRow
        suggestion={SUGGESTION}
        actions={ACTIONS}
        compact={false}
        isPending={false}
        onNotNow={() => undefined}
      />
    </div>
  );
};
