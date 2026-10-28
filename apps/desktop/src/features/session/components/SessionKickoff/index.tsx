import { useEffect, useRef, type ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { SessionDraftMount } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useLaunchMount } from '../../../inbox/useLaunchMount';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { useRunModel } from '../StartRun/useRunModel';
import { useStartRun } from '../StartRun/useStartRun';
import { runModelSlotOfShape } from '../../startRun/runModelSlotOf';
import { AutoPicksActions } from './AutoPicksActions';
import { StartKindChoice } from './StartKindChoice';
import { StartShapeForm } from './StartShapeForm';
import { StartTaskField } from './StartTaskField';
import { useRestoreLastStart } from './useRestoreLastStart';
import { useStartShape } from './useStartShape';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly notice?: ReactNode;
};

export const SessionKickoff = ({ workspaceId, notice }: Props) => {
  const pickedIssues = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues,
  );
  const projectIds = useAppStore((state) => selectSessionDraft({ state, workspaceId }).projectIds);
  const startKind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startKind);
  const startShape = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startShape);
  const isStarting = useAppStore((state) => selectSessionDraft({ state, workspaceId }).isStarting);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const [first] = pickedIssues;
  const launch = useLaunchMount({
    workspaceId,
    source:
      first === undefined
        ? null
        : { provider: first.provider, url: first.url, sentryProject: first.sentryProject ?? null },
  });
  const suggestedId = launch?.selectedId ?? null;
  const projectId = projectIds[0] ?? null;
  const mount: SessionDraftMount | null =
    launch === null || projectId === null || projectId !== suggestedId
      ? null
      : { projectId, reason: launch.reason };
  const prefilledRef = useRef<string | null>(null);
  useRestoreLastStart({ workspaceId });
  const limit = useAutoTreeLimit({ workspaceId });
  const agentKind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentKind);
  const shapeModel = useRunModel({
    workspaceId,
    sessionId: null,
    slot: runModelSlotOfShape({ shape: startShape ?? 'orchestrated', agentKind }),
  });
  const shapeRun = useStartShape({
    workspaceId,
    mount,
    prepare: limit.persist,
    model: shapeModel,
  });
  const autoRun = useStartRun({ workspaceId, sessionId: null, mount, prepare: limit.persist });

  useEffect(() => {
    if (suggestedId === null || prefilledRef.current === suggestedId) {
      return;
    }
    prefilledRef.current = suggestedId;
    if (projectIds.length === 0) {
      patchSessionDraft({ workspaceId, patch: { projectIds: [suggestedId] } });
    }
  }, [patchSessionDraft, projectIds.length, suggestedId, workspaceId]);

  const suggestedIds = suggestedId === null ? [] : [suggestedId];
  const isAutoPicks = startKind === 'auto';
  const isShaped = !isAutoPicks && startShape !== null;
  const isBusy = isStarting || shapeRun.isStarting || autoRun.isStarting;
  const hasGoal = autoRun.text.trim() !== '';

  return (
    <section aria-label="Kickoff" className="flex flex-col gap-6">
      <StartTaskField
        workspaceId={workspaceId}
        suggestedIds={suggestedIds}
        isDisabled={isBusy}
        isSubmitBlocked={!hasGoal || isBusy || (!isAutoPicks && !isShaped)}
        onSubmit={() => void (isAutoPicks ? autoRun.start() : shapeRun.start())}
      />
      {isAutoPicks ? null : <StartKindChoice workspaceId={workspaceId} isDisabled={isBusy} />}
      {isAutoPicks ? (
        <AutoPicksActions workspaceId={workspaceId} run={autoRun} limit={limit} />
      ) : null}
      {isShaped && startShape !== null ? (
        <StartShapeForm
          workspaceId={workspaceId}
          shape={startShape}
          run={shapeRun}
          limit={limit}
          model={shapeModel}
        />
      ) : null}
      {notice === undefined || notice === null ? null : (
        <div data-slot="kickoff-notice">{notice}</div>
      )}
    </section>
  );
};
