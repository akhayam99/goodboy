import { useId, type ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { NAMES } from '../../../../shared/utils/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import { AutoLevelChip } from '../../../auto/level/AutoLevelChip';
import { AGENT_KIND_META, type AgentKind } from '../../agent-kind';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { AUTO_RUN_AS } from '../../startRun/runAsOf';
import { routeLineOf } from '../../startRun/routeLineOf';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { StartAsksSetting } from '../SessionKickoff/StartAsksSetting';
import { StartPresetFields } from '../SessionKickoff/StartPresetFields';
import { StartRoleField } from '../SessionKickoff/StartRoleField';
import { RunModelChip } from '../StartRun/RunModelChip';
import type { StartRunModel } from '../StartRun/useStartRun';
import { StartEditsSetting } from './StartEditsSetting';
import { StartForm } from './StartForm';
import { StartGuidanceSetting } from './StartGuidanceSetting';
import { runAsOfStartFormKind, startFormKindOfRunAs } from './runAsOfStartKind';
import type { StartFormKind } from './startFormKinds';
import {
  startAsksOf,
  startFormHintOf,
  startFormNoteOf,
  startGuidanceReaderOf,
  startLabelOf,
  startLimitKindOf,
} from './startFormWords';
import { startSettingsOf } from './startSettingsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly role: AgentKind | null;
  readonly run: StartRunModel;
  readonly limit: AutoTreeLimitModel;
  readonly hint: string | null;
  readonly demoAnchor?: string;
  readonly actions: ReactNode;
};

type PickParams = {
  readonly next: StartFormKind;
};

export const RunsStartForm = ({
  workspaceId,
  sessionId,
  role,
  run,
  limit,
  hint,
  demoAnchor,
  actions,
}: Props) => {
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const reasonId = useId();
  const { runAs, route, presets, isStarting } = run;
  const isPinned = role !== null;
  const kind = isPinned ? 'agent' : startFormKindOfRunAs({ runAs });
  const hasText = run.text.trim() !== '';
  const isAutoLead = route.route.shape === 'lead' && route.role === null;
  const isPlan = route.route.shape === 'plan';
  const asks = startAsksOf({ kind, isAutoLead, isPlan });
  const guidanceReader = startGuidanceReaderOf({ kind, isAutoLead, isPlan });
  const limitKind = startLimitKindOf({
    kind,
    routeKind: limitKindOfRoute({ route: route.route }),
  });
  const isRouting = isPinned || kind === null;
  const modelSummary = recommendationSummary({
    provider: run.model.effective.provider,
    model: run.model.effective.model,
    effort: run.model.effective.effort,
  });
  const routeHint = hasText
    ? routeLineOf({ result: route, modelSummary, isModelShown: !isPinned })
    : hint;
  const shownHint = isRouting ? routeHint : startFormHintOf({ kind });
  const roleNoun = runAs.kind === 'role' ? AGENT_KIND_META[runAs.role].noun : '';

  const pickKind = ({ next }: PickParams): void => {
    run.setRunAs(next === kind ? AUTO_RUN_AS : runAsOfStartFormKind({ kind: next, presets }));
  };

  const settings = isPinned
    ? []
    : startSettingsOf({
        kind,
        nodes: {
          role:
            runAs.kind === 'role' ? (
              <StartRoleField
                value={runAs.role}
                isDisabled={isStarting}
                onChange={(next) => run.setRunAs({ kind: 'role', role: next })}
              />
            ) : null,
          model: <RunModelChip model={run.model} isDisabled={isStarting} />,
          asks:
            asks === 'level' ? (
              <AutoLevelChip
                value={run.level}
                workspaceLevel={run.workspaceLevel}
                error={null}
                workspaceName={workspaceName}
                isDisabled={isStarting}
                onPick={({ next }) => run.setLevel(next)}
              />
            ) : asks === 'steps' ? (
              <StartAsksSetting
                workspaceId={workspaceId}
                autonomy={run.autonomy}
                isDisabled={isStarting}
                onPick={({ next }) => run.setAutonomy(next)}
              />
            ) : null,
          edits: (
            <StartEditsSetting
              workspaceId={workspaceId}
              sessionId={sessionId}
              picked={run.edits}
              provider={run.model.effective.provider}
              isDisabled={isStarting}
              onPick={({ next }) => run.setEdits(next)}
            />
          ),
          limit:
            limitKind === null ? null : (
              <AutoLimitChip limit={limit} kind={limitKind} isDisabled={isStarting} />
            ),
          guidance: (
            <StartGuidanceSetting
              workspaceId={workspaceId}
              picked={run.guidance}
              reader={guidanceReader}
              isDisabled={isStarting}
              onPick={({ next }) => run.setGuidance(next)}
            />
          ),
        },
      });

  return (
    <StartForm
      kind={kind}
      hint={shownHint}
      isRouteHint={isRouting && hasText}
      hasPresets={presets.length > 0}
      isDisabled={isStarting}
      onKind={isPinned ? null : (next) => pickKind({ next })}
      fields={
        runAs.kind === 'preset' && !isPinned ? (
          <StartPresetFields
            presets={presets}
            presetId={presets.find((preset) => preset.id === runAs.presetId)?.id ?? null}
            closeness={runAs.closeness ?? 'follow'}
            isDisabled={isStarting}
            onPreset={({ next }) => run.setRunAs({ ...runAs, presetId: next })}
            onCloseness={({ next }) => run.setRunAs({ ...runAs, closeness: next })}
          />
        ) : null
      }
      settings={settings}
      note={isPinned ? null : startFormNoteOf({ kind })}
      error={run.error}
      reason={null}
      reasonId={reasonId}
    >
      {actions}
      {hasText && !isStarting ? (
        <Button variant="ghost" size="sm" onClick={run.discard}>
          {RUN_ROUTE_COPY.discard}
        </Button>
      ) : null}
      <Button
        size="sm"
        disabled={!hasText || isStarting}
        isBusy={isStarting}
        busyLabel={RUN_ROUTE_COPY.starting}
        onClick={() => void run.start()}
        data-demo-anchor={demoAnchor}
      >
        {run.error === null
          ? startLabelOf({ kind: isPinned ? null : kind, role: roleNoun })
          : NAMES.retry}
      </Button>
    </StartForm>
  );
};
