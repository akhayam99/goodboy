import { useId, type ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import type { AgentKind } from '../../agent-kind';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { routeLineOf } from '../../startRun/routeLineOf';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { AUTO_RUN_AS } from '../../startRun/runAsOf';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { StartRoleField } from '../SessionKickoff/StartRoleField';
import { StartRunBranchChip } from '../StartRun/StartRunBranchChip';
import type { StartRunModel } from '../StartRun/useStartRun';
import { liveStepsOf } from './liveStepsOf';
import { StartForm } from './StartForm';
import { runAsOfStartFormKind, startFormKindOfRunAs } from './runAsOfStartKind';
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
  readonly isSectioned?: boolean;
};

type PickParams = {
  readonly next: StartPlanKind;
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
  isSectioned = false,
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
  const routeHint = hasText ? routeLineOf({ result: route }) : hint;
  const shownHint = isRouting ? routeHint : null;
  const workflow =
    runAs.kind === 'preset'
      ? (presets.find((preset) => preset.id === runAs.presetId) ?? null)
      : null;
  const closeness = runAs.kind === 'preset' ? (runAs.closeness ?? 'follow') : 'follow';
  const steps = liveStepsOf({ workflow });
  const suggestion = kind === null ? run.suggestion : null;
  const edits = useStartEditsMode({ workspaceId, sessionId, picked: run.edits });
  const everyRun = useEveryRunFacts({ workspaceId });
  const reason = blockedReason ?? (hasText ? null : START_KIND_COPY.goalNeeded);

  const pickKind = ({ next }: PickParams): void => {
    if (next === (kind === 'agent' ? 'agent' : 'lead')) {
      return;
    }
    run.setRunAs(runAsOfStartFormKind({ kind: next, presets }));
  };
  const scopeLine =
    shownHint ??
    (kind === 'agent'
      ? RUN_ROUTE_COPY.scope.agent
      : workflow === null
        ? null
        : RUN_ROUTE_COPY.fromPreset({ name: workflow.name }));
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
    limit: { view: limit.view, kind: limitKind, mode: everyRun.limitMode },
    replies: everyRun.replies,
  });

  return (
    <StartForm
      plan={
        isPinned ? null : (
          <StartPlanRow
            kind={kind ?? 'lead'}
            isDisabled={isStarting}
            isSectioned={isSectioned}
            onPick={(next) => pickKind({ next })}
            pick={
              runAs.kind === 'role' ? (
                <StartRoleField
                  value={runAs.role}
                  isDisabled={isStarting}
                  onChange={(next) => run.setRunAs({ kind: 'role', role: next })}
                />
              ) : (
                <StartWorkflowPill
                  presets={presets}
                  workflow={workflow}
                  likely={suggestion}
                  closeness={closeness}
                  isDisabled={isStarting}
                  onPick={({ next }) =>
                    run.setRunAs(
                      next === null
                        ? AUTO_RUN_AS
                        : {
                            kind: 'preset',
                            presetId: next.id,
                            closeness: runAs.kind === 'preset' ? closeness : 'adapt',
                          },
                    )
                  }
                  onCloseness={({ next }) =>
                    runAs.kind === 'preset'
                      ? run.setRunAs({ ...runAs, closeness: next })
                      : undefined
                  }
                />
              )
            }
            detail={steps.length > 0 ? <StartWorkflowSteps steps={steps} /> : null}
          />
        )
      }
      runsOn={
        <StartWhereItRuns workspaceId={workspaceId} model={run.model} isDisabled={isStarting} />
      }
      hint={isSectioned ? scopeLine : shownHint}
      isRouteHint={isRouting && hasText}
      isSectioned={isSectioned}
      settings={settings}
      note={note}
      error={run.error}
      reason={reason}
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
        disabled={reason !== null || isStarting}
        {...(reason !== null && { 'aria-describedby': reasonId })}
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
