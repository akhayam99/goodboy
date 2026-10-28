import { useId } from 'react';
import { Button, FormActions } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { StartShape } from '../../../../store/slices/sessionDraft/state';
import { NAMES } from '../../../../shared/utils/names';
import { AutoLimitChip } from '../../../auto/AutoLimitChip';
import type { AutoTreeLimitModel } from '../../../auto/useAutoTreeLimit';
import { AGENT_KIND_META } from '../../agent-kind';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { RunModelChip } from '../StartRun/RunModelChip';
import type { RunModelView } from '../StartRun/useRunModel';
import { hasAsksGate } from './hasAsksGate';
import { StartAgentFields } from './StartAgentFields';
import { StartAsksSetting } from './StartAsksSetting';
import { StartPresetFields } from './StartPresetFields';
import type { StartShapeModel } from './useStartShape';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly shape: StartShape;
  readonly run: StartShapeModel;
  readonly limit: AutoTreeLimitModel;
  readonly model: RunModelView;
};

type LabelParams = {
  readonly shape: StartShape;
  readonly role: string;
};

const startLabelOf = ({ shape, role }: LabelParams): string => {
  if (shape === 'agent') {
    return START_KIND_COPY.start.agent({ role });
  }
  return START_KIND_COPY.start[shape];
};

type ReasonParams = {
  readonly hasGoal: boolean;
  readonly isPresetMissing: boolean;
};

const reasonOf = ({ hasGoal, isPresetMissing }: ReasonParams): string | null => {
  if (!hasGoal) {
    return START_KIND_COPY.goalNeeded;
  }
  if (isPresetMissing) {
    return START_KIND_COPY.presetNeeded;
  }
  return null;
};

export const StartShapeForm = ({ workspaceId, shape, run, limit, model }: Props) => {
  const hasGoal = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).workflowGoal.trim() !== '',
  );
  const agentKind = useAppStore((state) => selectSessionDraft({ state, workspaceId }).agentKind);
  const hasTask = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues.length > 0,
  );
  const hasPreset = useAppStore((state) => {
    const presetId = selectSessionDraft({ state, workspaceId }).workflowId;
    return (state.phaseTemplates[workspaceId] ?? []).some(
      (workflow) => workflow.isPreset === true && workflow.id === presetId,
    );
  });
  const discardSessionDraft = useAppStore((state) => state.discardSessionDraft);
  const reasonId = useId();
  const role = AGENT_KIND_META[agentKind].noun;
  const reason = reasonOf({ hasGoal, isPresetMissing: shape === 'preset' && !hasPreset });
  const card = START_KIND_COPY.shapes[shape];

  return (
    <section aria-label={`${card.label} form`} className="flex flex-col gap-6">
      <p className="text-meta text-muted-foreground">{card.whileRuns}</p>
      {shape === 'preset' ? (
        <StartPresetFields workspaceId={workspaceId} isDisabled={run.isStarting} />
      ) : null}
      <FormActions
        leading={
          shape === 'agent' ? (
            <StartAgentFields workspaceId={workspaceId} isDisabled={run.isStarting} />
          ) : (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {hasAsksGate({ shape }) ? (
                <StartAsksSetting workspaceId={workspaceId} isDisabled={run.isStarting} />
              ) : null}
              <RunModelChip model={model} isDisabled={run.isStarting} />
              <AutoLimitChip
                usd={limit.usd}
                isFromSession={limit.isFromSession}
                isDisabled={run.isStarting}
                onChange={limit.change}
              />
            </div>
          )
        }
        error={run.error}
        reason={reason}
        reasonId={reasonId}
      >
        {(hasGoal || hasTask) && !run.isStarting ? (
          <Button variant="ghost" size="md" onClick={() => discardSessionDraft({ workspaceId })}>
            {START_KIND_COPY.discard}
          </Button>
        ) : null}
        <Button
          size="md"
          disabled={reason !== null || run.isStarting}
          isBusy={run.isStarting}
          busyLabel={START_KIND_COPY.starting}
          onClick={() => void run.start()}
          {...(reason !== null && { 'aria-describedby': reasonId })}
        >
          {run.error === null ? startLabelOf({ shape, role }) : NAMES.retry}
        </Button>
      </FormActions>
    </section>
  );
};
