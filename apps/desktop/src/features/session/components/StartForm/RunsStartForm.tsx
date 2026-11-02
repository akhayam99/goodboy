import { useId, type ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { recommendationSummary } from '../../../../shared/components/RoutingPicker/recommendationSummary';
import { NAMES } from '../../../../shared/utils/names';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import type { AgentKind } from '../../agent-kind';
import { limitDefaultFromOfKind } from './limitDefaultFromOfKind';
import { limitKindOfRoute } from '../../startRun/limitKindOfRoute';
import { AUTO_RUN_AS } from '../../startRun/runAsOf';
import { routeLineOf } from '../../startRun/routeLineOf';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import { StartPresetFields } from '../SessionKickoff/StartPresetFields';
import type { StartRunModel } from '../StartRun/useStartRun';
import { StartForm } from './StartForm';
import { runAsOfStartFormKind, startFormKindOfRunAs } from './runAsOfStartKind';
import type { StartFormKind } from './startFormKinds';
import {
  startAsksOf,
  startFormHintOf,
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
  const limitView = limit.viewOf({ defaultFrom: limitDefaultFromOfKind({ kind }) });
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

  const pickKind = ({ next }: PickParams): void => {
    run.setRunAs(next === kind ? AUTO_RUN_AS : runAsOfStartFormKind({ kind: next, presets }));
  };

  const settings = isPinned
    ? []
    : startSettingItemsOf({
        kind,
        workspaceId,
        sessionId,
        workspaceName,
        isDisabled: isStarting,
        model: run.model,
        where: null,
        role:
          runAs.kind === 'role'
            ? {
                value: runAs.role,
                onChange: ({ next }) => run.setRunAs({ kind: 'role', role: next }),
              }
            : null,
        asks,
        level: {
          value: run.level,
          workspaceLevel: run.workspaceLevel,
          onPick: ({ next }) => run.setLevel(next),
        },
        autonomy: { value: run.autonomy, onPick: ({ next }) => run.setAutonomy(next) },
        edits: { value: run.edits, onPick: ({ next }) => run.setEdits(next) },
        guidance: {
          value: run.guidance,
          reader: guidanceReader,
          onPick: ({ next }) => run.setGuidance(next),
        },
        limit: { view: limitView, kind: limitKind },
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
        {run.error === null ? NAMES.start : NAMES.retry}
      </Button>
    </StartForm>
  );
};
