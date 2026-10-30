import { useId, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@goodboy/ui';
import type { ProjectId, Workflow, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { NAMES } from '../../../../shared/utils/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import { AutoLevelChip } from '../../../auto/level/AutoLevelChip';
import { AGENT_KIND_META } from '../../agent-kind';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { routeLineOf } from '../../startRun/routeLineOf';
import { useWorkspaceKindRouting } from '../../../../shared/hooks/useWorkspaceKindRouting';
import { StartAgentModel } from '../SessionKickoff/StartAgentModel';
import { StartAsksSetting } from '../SessionKickoff/StartAsksSetting';
import { StartPresetFields } from '../SessionKickoff/StartPresetFields';
import { StartRoleField } from '../SessionKickoff/StartRoleField';
import { WhereChip } from '../SessionKickoff/WhereChip';
import type { StartShapeModel } from '../SessionKickoff/useStartShape';
import { RunModelChip } from '../StartRun/RunModelChip';
import type { RunModelView } from '../StartRun/useRunModel';
import type { StartRunModel } from '../StartRun/useStartRun';
import { StartEditsSetting } from './StartEditsSetting';
import { StartForm } from './StartForm';
import { startFormKindOfDraft, startShapeOfFormKind, type StartFormKind } from './startFormKinds';
import {
  startAsksOf,
  startFormHintOf,
  startFormNoteOf,
  startLabelOf,
  startLimitKindOf,
  startReasonOf,
} from './startFormWords';
import { startSettingsOf } from './startSettingsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly suggestedIds: ReadonlyArray<ProjectId>;
  readonly shapeRun: StartShapeModel;
  readonly autoRun: StartRunModel;
  readonly limit: AutoTreeLimitModel;
  readonly shapeModel: RunModelView;
};

type PickParams = {
  readonly next: StartFormKind;
};

const NO_PRESETS: ReadonlyArray<Workflow> = [];

export const NewSessionStartForm = ({
  workspaceId,
  suggestedIds,
  shapeRun,
  autoRun,
  limit,
  shapeModel,
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
        agentRouting: current.agentRouting,
        permissionMode: current.permissionMode,
        autonomy: current.autonomy,
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
  const kind = startFormKindOfDraft({ startKind: draft.startKind, startShape: draft.startShape });
  const run = kind === null ? autoRun : shapeRun;
  const isDisabled = run.isStarting;
  const reason = startReasonOf({
    hasGoal,
    kind,
    hasPreset: presets.some((preset) => preset.id === draft.workflowId),
  });
  const { route } = autoRun;
  const asks = startAsksOf({
    kind,
    isAutoLead: route.route.shape === 'lead' && route.role === null,
    isPlan: route.route.shape === 'plan',
  });
  const limitKind = startLimitKindOf({
    kind,
    routeKind: limitKindOfRoute({ route: route.route }),
  });
  const model = kind === null ? autoRun.model : shapeModel;
  const agentSuggestion = useWorkspaceKindRouting({ workspaceId, kind: draft.agentKind });
  const agentModel = draft.agentRouting ?? agentSuggestion;
  const hint =
    kind === null && hasGoal
      ? routeLineOf({
          result: route,
          modelSummary: recommendationSummary({
            provider: autoRun.model.effective.provider,
            model: autoRun.model.effective.model,
            effort: autoRun.model.effective.effort,
          }),
          isModelShown: true,
        })
      : startFormHintOf({ kind });

  const pickKind = ({ next }: PickParams): void => {
    if (next === kind) {
      patchSessionDraft({
        workspaceId,
        patch: { startKind: 'auto', startShape: null, hasChosenStart: true },
      });
      return;
    }
    patchSessionDraft({
      workspaceId,
      patch: {
        startKind: next === 'orchestrated' || next === 'preset' ? 'workflow' : 'agent',
        startShape: startShapeOfFormKind({ kind: next }),
        hasChosenStart: true,
      },
    });
  };

  const settings = startSettingsOf({
    kind,
    nodes: {
      where: (
        <WhereChip workspaceId={workspaceId} suggestedIds={suggestedIds} isDisabled={isDisabled} />
      ),
      role: (
        <StartRoleField
          value={draft.agentKind}
          isDisabled={isDisabled}
          onChange={(next) =>
            patchSessionDraft({ workspaceId, patch: { agentKind: next, agentRouting: null } })
          }
        />
      ),
      model:
        kind === 'agent' ? (
          <StartAgentModel workspaceId={workspaceId} isDisabled={isDisabled} />
        ) : (
          <RunModelChip model={model} isDisabled={isDisabled} />
        ),
      asks:
        asks === 'level' ? (
          <AutoLevelChip
            value={autoRun.level}
            workspaceLevel={autoRun.workspaceLevel}
            error={null}
            workspaceName={workspaceName}
            isDisabled={isDisabled}
            onPick={({ next }) => autoRun.setLevel(next)}
          />
        ) : asks === 'steps' ? (
          <StartAsksSetting
            workspaceId={workspaceId}
            autonomy={draft.autonomy}
            isDisabled={isDisabled}
            onPick={({ next }) => patchSessionDraft({ workspaceId, patch: { autonomy: next } })}
          />
        ) : null,
      edits: (
        <StartEditsSetting
          workspaceId={workspaceId}
          sessionId={null}
          picked={draft.permissionMode}
          provider={kind === 'agent' ? agentModel.provider : model.effective.provider}
          isDisabled={isDisabled}
          onPick={({ next }) => patchSessionDraft({ workspaceId, patch: { permissionMode: next } })}
        />
      ),
      limit:
        limitKind === null ? null : (
          <AutoLimitChip limit={limit} kind={limitKind} isDisabled={isDisabled} />
        ),
    },
  });

  return (
    <StartForm
      kind={kind}
      hint={hint}
      isRouteHint={kind === null && hasGoal}
      hasPresets={presets.length > 0}
      isDisabled={isDisabled}
      onKind={(next) => pickKind({ next })}
      fields={
        kind === 'preset' ? (
          <StartPresetFields
            presets={presets}
            presetId={draft.workflowId}
            closeness={draft.presetCloseness}
            isDisabled={isDisabled}
            onPreset={({ next }) => patchSessionDraft({ workspaceId, patch: { workflowId: next } })}
            onCloseness={({ next }) =>
              patchSessionDraft({ workspaceId, patch: { presetCloseness: next } })
            }
          />
        ) : null
      }
      settings={settings}
      note={startFormNoteOf({ kind })}
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
        {run.error === null
          ? startLabelOf({ kind, role: AGENT_KIND_META[draft.agentKind].noun })
          : NAMES.retry}
      </Button>
    </StartForm>
  );
};
