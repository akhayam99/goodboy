import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { ProjectMatch } from '../../../../shared/components/ProjectPicker/projectMatch';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { NAMES } from '../../../../shared/utils/names';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { routeLineOf } from '../../startRun/routeLineOf';
import { StartRoleField } from '../SessionKickoff/StartRoleField';
import { WhereChip } from '../SessionKickoff/WhereChip';
import { useDraftProjects } from '../SessionKickoff/WhereChip/useDraftProjects';
import type { StartShapeModel } from '../SessionKickoff/useStartShape';
import type { RunModelView } from '../StartRun/useRunModel';
import type { StartRunModel } from '../StartRun/useStartRun';
import { liveStepsOf } from './liveStepsOf';
import { StartForm } from './StartForm';
import { startFormKindOfDraft, startShapeOfFormKind, type StartFormKind } from './startFormKinds';
import { StartPlanRow, type StartPlanKind } from './StartPlanRow';
import { StartWhereItRuns } from './StartWhereItRuns';
import { StartWorkflowPill } from './StartWorkflowPill';
import { StartWorkflowSteps } from './StartWorkflowSteps';
import { useEveryRunFacts } from './useEveryRunFacts';
import { useStartEditsMode } from './useStartEditsMode';
import {
  startAsksOf,
  startFormNoteOf,
  startGuidanceReaderOf,
  startLimitKindOf,
  startReasonOf,
} from './startFormWords';
import { startSettingItemsOf } from './startSettingItemsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly match: ProjectMatch | null;
  readonly shapeRun: StartShapeModel;
  readonly autoRun: StartRunModel;
  readonly limit: AutoTreeLimitModel;
  readonly model: RunModelView;
};

type PickParams = {
  readonly next: StartFormKind;
  readonly workflowId?: WorkflowId;
};

const NO_PRESETS: ReadonlyArray<Workflow> = [];

export const NewSessionStartForm = ({
  workspaceId,
  match,
  shapeRun,
  autoRun,
  limit,
  model,
}: Props) => {
  const draft = useAppStore(
    useShallow((state) => {
      const current = selectSessionDraft({ state, workspaceId });
      return {
        startKind: current.startKind,
        startShape: current.startShape,
        workflowId: current.workflowId,
        presetCloseness: current.presetCloseness,
        agentKind: current.agentKind,
        permissionMode: current.permissionMode,
        autonomy: current.autonomy,
        guidance: current.guidance,
      };
    }),
  );
  const hasGoal = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).workflowGoal.trim() !== '',
  );
  const hasTask = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues.length > 0,
  );
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId] ?? EMPTY_ARRAY);
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const discardSessionDraft = useAppStore((state) => state.discardSessionDraft);
  const reasonId = useId();
  const presets = useMemo(
    () =>
      templates.length === 0 ? NO_PRESETS : templates.filter((entry) => entry.isPreset === true),
    [templates],
  );
  const kind = startFormKindOfDraft({
    startKind: draft.startKind,
    startShape: draft.startShape,
    workflowId: draft.workflowId,
  });
  const run = kind === null ? autoRun : shapeRun;
  const isDisabled = run.isStarting;
  const workflow = presets.find((preset) => preset.id === draft.workflowId) ?? null;
  const steps = liveStepsOf({ workflow });
  const where = useDraftProjects({ workspaceId });
  const everyRun = useEveryRunFacts({ workspaceId });
  const edits = useStartEditsMode({ workspaceId, sessionId: null, picked: draft.permissionMode });
  const reason = startReasonOf({ hasGoal });
  const { route } = autoRun;
  const suggestion = kind === null ? autoRun.suggestion : null;
  const isAutoLead = route.route.shape === 'lead' && route.role === null;
  const isPlan = route.route.shape === 'plan';
  const asks = startAsksOf({ kind, isAutoLead, isPlan });
  const guidanceReader = startGuidanceReaderOf({ kind, isAutoLead, isPlan });
  const limitKind = startLimitKindOf({
    kind,
    routeKind: limitKindOfRoute({ route: route.route }),
  });
  const isRouteHint = kind === null && hasGoal;
  const hint = isRouteHint ? routeLineOf({ result: route }) : null;

  const pickKind = ({ next, workflowId }: PickParams): void => {
    if (next === 'lead') {
      patchSessionDraft({
        workspaceId,
        patch: { startKind: 'auto', startShape: null, workflowId: null, hasChosenStart: true },
      });
      return;
    }
    patchSessionDraft({
      workspaceId,
      patch: {
        startKind: next === 'preset' ? 'workflow' : 'agent',
        startShape: startShapeOfFormKind({ kind: next }),
        hasChosenStart: true,
        ...(workflowId !== undefined && { workflowId, presetCloseness: 'adapt' }),
      },
    });
  };

  const settings = startSettingItemsOf({
    kind,
    workspaceId,
    sessionId: null,
    workspaceName,
    isDisabled,
    model,
    where: {
      node: <WhereChip workspaceId={workspaceId} match={match} isDisabled={isDisabled} />,
      names: where.projects.length === 0 ? null : where.names,
    },
    asks,
    level: {
      value: autoRun.level,
      workspaceLevel: autoRun.workspaceLevel,
      onPick: ({ next }) => autoRun.setLevel(next),
    },
    autonomy: {
      value: draft.autonomy,
      onPick: ({ next }) => patchSessionDraft({ workspaceId, patch: { autonomy: next } }),
    },
    edits: {
      value: draft.permissionMode,
      mode: edits.mode,
      onPick: ({ next }) => patchSessionDraft({ workspaceId, patch: { permissionMode: next } }),
    },
    guidance: {
      value: draft.guidance,
      reader: guidanceReader,
      onPick: ({ next }) => patchSessionDraft({ workspaceId, patch: { guidance: next } }),
    },
    limit: { view: limit.view, kind: limitKind, mode: everyRun.limitMode },
    replies: everyRun.replies,
  });

  return (
    <StartForm
      plan={
        <StartPlanRow
          kind={kind ?? 'lead'}
          isDisabled={isDisabled}
          onPick={(next: StartPlanKind) => pickKind({ next })}
          pick={
            kind === 'agent' ? (
              <StartRoleField
                value={draft.agentKind}
                isDisabled={isDisabled}
                onChange={(next) =>
                  patchSessionDraft({ workspaceId, patch: { agentKind: next, agentRouting: null } })
                }
              />
            ) : (
              <StartWorkflowPill
                presets={presets}
                workflow={workflow}
                likely={suggestion}
                closeness={draft.presetCloseness}
                isDisabled={isDisabled}
                onPick={({ next }) =>
                  next === null
                    ? pickKind({ next: 'lead' })
                    : pickKind({ next: 'preset', workflowId: next.id })
                }
                onCloseness={({ next }) =>
                  patchSessionDraft({ workspaceId, patch: { presetCloseness: next } })
                }
              />
            )
          }
          detail={
            kind === 'preset' && steps.length > 0 ? <StartWorkflowSteps steps={steps} /> : null
          }
        />
      }
      runsOn={<StartWhereItRuns workspaceId={workspaceId} model={model} isDisabled={isDisabled} />}
      hint={hint}
      isRouteHint={isRouteHint}
      settings={settings}
      note={
        isRouteHint ? null : startFormNoteOf({ kind, workflow, closeness: draft.presetCloseness })
      }
      error={run.error}
      reason={reason}
      reasonId={reasonId}
    >
      {(hasGoal || hasTask) && !isDisabled ? (
        <Button variant="ghost" size="md" onClick={() => discardSessionDraft({ workspaceId })}>
          {START_KIND_COPY.discard}
        </Button>
      ) : null}
      <Button
        size="md"
        data-demo-anchor="draft-start"
        disabled={reason !== null || isDisabled}
        isBusy={isDisabled}
        busyLabel={START_KIND_COPY.starting}
        onClick={() => void run.start()}
        {...(reason !== null && { 'aria-describedby': reasonId })}
      >
        {run.error === null ? NAMES.start : NAMES.retry}
      </Button>
    </StartForm>
  );
};
