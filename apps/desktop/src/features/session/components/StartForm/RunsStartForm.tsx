import { useId, type ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { NAMES } from '../../../../shared/utils/names';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import type { AgentKind } from '../../agent-kind';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { routeLineOf } from '../../startRun/routeLineOf';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { StartRoleField } from '../SessionKickoff/StartRoleField';
import { StartRunBranchChip } from '../StartRun/StartRunBranchChip';
import type { StartRunModel } from '../StartRun/useStartRun';
import { liveStepsOf } from './liveStepsOf';
import { StartForm } from './StartForm';
import { runAsOfStartFormKind, startFormKindOfRunAs } from './runAsOfStartKind';
import type { StartFormKind } from './startFormKinds';
import { StartPlanRow } from './StartPlanRow';
import { StartWorkflowPick } from './StartWorkflowPick';
import { StartWorkflowSteps } from './StartWorkflowSteps';
import { StartWorkflowSuggestion } from './StartWorkflowSuggestion';
import { useStartEditsMode } from './useStartEditsMode';
import {
  startAsksOf,
  startFormNoteOf,
  startGuidanceReaderOf,
  startLimitKindOf,
} from './startFormWords';
import { startSettingItemsOf } from './startSettingItemsOf';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly role: AgentKind | null;
  readonly run: StartRunModel;
  readonly limit: AutoTreeLimitModel;
  readonly hint: string | null;
  readonly demoAnchor?: string;
  readonly actions: ReactNode;
  readonly note?: string | null;
  readonly blockedReason?: string | null;
  readonly canDiscard?: boolean;
  readonly isBranchLocked?: boolean;
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
  note: fixedNote,
  blockedReason = null,
  canDiscard = true,
  isBranchLocked = false,
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
  const shownHint = isRouting ? routeHint : null;
  const workflow =
    runAs.kind === 'preset'
      ? (presets.find((preset) => preset.id === runAs.presetId) ?? null)
      : null;
  const closeness = runAs.kind === 'preset' ? (runAs.closeness ?? 'follow') : 'follow';
  const steps = liveStepsOf({ workflow });
  const suggestion = kind === null ? run.suggestion : null;
  const edits = useStartEditsMode({ workspaceId, sessionId, picked: run.edits });

  const pickKind = ({ next }: PickParams): void => {
    if (next === kind) {
      return;
    }
    run.setRunAs(runAsOfStartFormKind({ kind: next, presets }));
  };
  const note =
    fixedNote !== undefined
      ? fixedNote
      : isPinned || shownHint !== null
        ? null
        : startFormNoteOf({ kind, workflow, closeness });

  const settings = startSettingItemsOf({
    kind,
    workspaceId,
    sessionId,
    workspaceName,
    isDisabled: isStarting,
    model: run.model,
    where: {
      node:
        sessionId === null ? null : (
          <StartRunBranchChip
            sessionId={sessionId}
            branch={run.branch}
            isDisabled={isStarting || isBranchLocked}
            onChange={run.setBranch}
          />
        ),
      names: null,
    },
    asks,
    level: {
      value: run.level,
      workspaceLevel: run.workspaceLevel,
      onPick: ({ next }) => run.setLevel(next),
    },
    autonomy: { value: run.autonomy, onPick: ({ next }) => run.setAutonomy(next) },
    edits: { value: run.edits, mode: edits.mode, onPick: ({ next }) => run.setEdits(next) },
    guidance: {
      value: run.guidance,
      reader: guidanceReader,
      onPick: ({ next }) => run.setGuidance(next),
    },
    limit: { view: limit.view, kind: limitKind },
  });

  return (
    <StartForm
      plan={
        isPinned ? null : (
          <StartPlanRow
            kind={kind ?? 'lead'}
            hasPresets={presets.length > 0}
            isDisabled={isStarting}
            onPick={(next) => pickKind({ next })}
            pick={
              runAs.kind === 'preset' ? (
                <StartWorkflowPick
                  presets={presets}
                  presetId={workflow?.id ?? null}
                  closeness={closeness}
                  isDisabled={isStarting}
                  onPreset={({ next }) => run.setRunAs({ ...runAs, presetId: next })}
                  onCloseness={({ next }) => run.setRunAs({ ...runAs, closeness: next })}
                />
              ) : runAs.kind === 'role' ? (
                <StartRoleField
                  value={runAs.role}
                  isDisabled={isStarting}
                  onChange={(next) => run.setRunAs({ kind: 'role', role: next })}
                />
              ) : null
            }
            detail={
              steps.length > 0 ? (
                <StartWorkflowSteps steps={steps} />
              ) : suggestion !== null ? (
                <StartWorkflowSuggestion
                  workflow={suggestion}
                  isDisabled={isStarting}
                  onUse={() =>
                    run.setRunAs({ kind: 'preset', presetId: suggestion.id, closeness: 'adapt' })
                  }
                />
              ) : null
            }
          />
        )
      }
      hint={shownHint}
      isRouteHint={isRouting && hasText}
      settings={settings}
      note={note}
      error={run.error}
      reason={blockedReason}
      reasonId={reasonId}
    >
      {actions}
      {canDiscard && hasText && !isStarting ? (
        <Button variant="ghost" size="sm" onClick={run.discard}>
          {RUN_ROUTE_COPY.discard}
        </Button>
      ) : null}
      <Button
        size="sm"
        disabled={!hasText || isStarting || blockedReason !== null}
        {...(blockedReason !== null && { 'aria-describedby': reasonId })}
        isBusy={isStarting}
        busyLabel={RUN_ROUTE_COPY.starting}
        onClick={() => void run.start()}
        data-demo-anchor={demoAnchor}
      >
        {run.error === null ? NAMES.start : NAMES.retry}
      </Button>
    </StartForm>
  );
};
