import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { runsForWorkflowRun } from '@goodboy/core';
import {
  Button,
  PANE_RHYTHM,
  ScrollFade,
  SectionHeader,
  cn,
  formatError,
  useEscapeLayer,
} from '@goodboy/ui';
import type { Agent, AgentId, ProviderId, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionSlots, useSessionSlotsLoad } from '../../../../store';
import { selectActiveMount } from '../../../../store/slices/project-mounts/selectors';
import { FocusedPane } from '../../../../shared/components/PaneShell/FocusedPane';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { workflowAvailabilitySnapshot } from '../../../workflows/workflowAvailabilitySnapshot';
import { useAttachedWorkflowRuns } from '../../../workflows/useAttachedWorkflowRuns';
import { workflowKindName } from '../../../workspace/components/WorkspacesSidebar/lib';
import { ARTIFACT_BRIEF_LIMITS } from '../../artifactBrief';
import { sessionGoalText } from '../../sessionGoalText';
import { briefInventoryRow, replaceInventoryRow } from '../../artifactContextInventory';
import { resolveArtifactCtaState } from '../../artifactCtaState';
import { artifactCreationGate } from '../../artifactCreationGate';
import { ARTIFACT_CREATION_ADAPTERS } from '../../artifactCreationAdapters';
import type { GeneratedArtifactKind } from '../../artifactCollection';
import { ArtifactAttachmentsField } from './ArtifactAttachmentsField';
import { ArtifactBasedOnField, type ArtifactRunOption } from './ArtifactBasedOnField';
import { ArtifactBriefField } from './ArtifactBriefField';
import { ArtifactChoiceRows } from './ArtifactChoiceRows';
import { ArtifactContextDisclosure } from './ArtifactContextDisclosure';
import { ArtifactCreationFooter } from './ArtifactCreationFooter';
import { useArtifactAttachments } from './useArtifactAttachments';
import { useArtifactContextPreview } from './useArtifactContextPreview';
import { useArtifactCreationDraft } from './useArtifactCreationDraft';

type Props = {
  readonly sessionId: SessionId;
  readonly session: Session;
  readonly kind: GeneratedArtifactKind;
  readonly note: string | null;
  readonly count: number;
  readonly onClose: () => void;
  readonly onStarted: (agentId: AgentId) => void;
};

const runOptions = ({
  attached,
}: {
  readonly attached: ReturnType<typeof useAttachedWorkflowRuns>;
}): ReadonlyArray<ArtifactRunOption> => {
  const live = attached.filter(({ run }) => run.discardedAt == null);
  const names = live.map(({ workflow }) => workflowKindName(workflow));
  return live.map(({ run, workflow }) => {
    const name = workflowKindName(workflow);
    const isAmbiguous = names.filter((entry) => entry === name).length > 1;
    return {
      workflowRunId: run.id,
      label: isAmbiguous ? `${name} #${run.ordinal}` : name,
    };
  });
};

export const ArtifactCreationPane = ({
  sessionId,
  session,
  kind,
  note,
  count,
  onClose,
  onStarted,
}: Props) => {
  const adapter = ARTIFACT_CREATION_ADAPTERS[kind];
  const handle = useArtifactCreationDraft({ sessionId, kind });
  const { draft, brief, attachments, choice, secondChoice, basedOn, routing, isEmpty } = handle;
  const files = useArtifactAttachments({ sessionId, onChange: handle.setAttachments });
  const [isStarting, setIsStarting] = useState(false);
  const [isDiscardArmed, setIsDiscardArmed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slots = useSessionSlots(sessionId);
  const slotsLoad = useSessionSlotsLoad(sessionId);
  const ensureSessionSlots = useAppStore((s) => s.ensureSessionSlots);
  const goal = sessionGoalText({ slots, session });
  const isGoalPending = slotsLoad === null;

  useEffect(() => {
    void ensureSessionSlots(sessionId);
  }, [ensureSessionSlots, sessionId]);

  const attached = useAttachedWorkflowRuns({ session });
  const runs = useMemo(() => runOptions({ attached }), [attached]);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const isSummarizerRunning = useAppStore(
    (s) => s.summarizerStatus?.[sessionId]?.status === 'running',
  );
  const workflowRunId = basedOn.kind === 'workflow-run' ? basedOn.workflowRunId : null;
  const runAgents = useMemo(
    () => (workflowRunId === null ? null : runsForWorkflowRun(agents, workflowRunId)),
    [agents, workflowRunId],
  );
  const sourceAgents = runAgents ?? agents;
  const hasSourceActiveTurn = useAppStore((s) =>
    sourceAgents.some((agent) => {
      const turn = s.agentTurnState?.[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const hasSessionActiveTurn = useAppStore((s) =>
    agents.some((agent) => {
      const turn = s.agentTurnState?.[agent.id];
      return turn?.kind === 'running' || turn?.kind === 'starting';
    }),
  );
  const connectedProviders = useAppStore(
    useShallow((s): ReadonlyArray<ProviderId> => {
      const availability = workflowAvailabilitySnapshot({
        providers: s.providers ?? [],
        cooldowns: s.providerCooldowns ?? {},
        alerts: s.budgetAlerts ?? [],
        sessionId,
        isRunBudgetBlocked: false,
        nowMs: Date.now(),
      });
      return availability.connectedProviders.filter(
        (provider) =>
          !availability.coolingDownProviders.includes(provider) &&
          !availability.budgetBlockedProviders.includes(provider),
      );
    }),
  );
  const recommendation = useAppStore(
    useShallow((s) => adapter.resolveRouting({ state: s, sessionId, choice })),
  );
  const repo = useAppStore(
    useShallow((s) => {
      const mount = selectActiveMount({ state: s, sessionId });
      return mount === null
        ? null
        : {
            mountName: mount.mountName,
            branch: mount.branch,
            baseBranch: mount.baseBranch ?? 'main',
          };
    }),
  );
  const spawnActions = useAppStore(
    useShallow((s) => ({
      spawnReportAgent: s.spawnReportAgent,
      spawnWireframeAgent: s.spawnWireframeAgent,
    })),
  );
  const setArtifactFilter = useAppStore((s) => s.setArtifactFilter);
  const clearArtifactDraft = useAppStore((s) => s.clearArtifactDraft);

  const { setBasedOn } = handle;
  useEffect(() => {
    if (
      basedOn.kind === 'workflow-run' &&
      !runs.some((run) => run.workflowRunId === basedOn.workflowRunId)
    ) {
      setBasedOn({ kind: 'session' });
    }
  }, [basedOn, runs, setBasedOn]);

  const preview = useArtifactContextPreview({
    sessionId,
    kind,
    basedOn,
    choice,
    secondChoice,
    attachments,
  });
  const inventory = useMemo(
    () => replaceInventoryRow({ rows: preview.inventory, row: briefInventoryRow({ brief }) }),
    [preview.inventory, brief],
  );

  const ctaState = resolveArtifactCtaState({
    agents,
    runAgents,
    hasSourceActiveTurn,
    hasSessionActiveTurn,
    isSummarizerRunning,
  });
  const gate = artifactCreationGate({
    kind,
    ctaState,
    basedOn,
    hasBrief: brief.trim().length > 0,
    isBriefOverLimit: brief.trim().length > ARTIFACT_BRIEF_LIMITS.chars,
    hasUsableProvider: connectedProviders.length > 0,
    isStarting,
    isCollecting: preview.status === 'collecting',
  });

  useEscapeLayer(onClose);

  const generate = () => {
    if (gate.isDisabled || isStarting) {
      return;
    }
    setIsStarting(true);
    setError(null);
    adapter
      .spawn({ actions: spawnActions, sessionId, draft })
      .then((agentId) => {
        setArtifactFilter({ sessionId, filter: kind });
        clearArtifactDraft({ sessionId, kind });
        onStarted(agentId);
        onClose();
      })
      .catch((cause: unknown) => {
        setError(formatError(cause));
      })
      .finally(() => {
        setIsStarting(false);
      });
  };

  return (
    <FocusedPane
      lens="Artifacts"
      count={count}
      actions={
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft size={ICON_SIZE.row} aria-hidden />
          All artifacts
        </Button>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
          <div
            data-testid="artifact-creation-pane"
            className={cn(
              PANE_RHYTHM.column,
              PANE_RHYTHM.measure.reading,
              PANE_RHYTHM.stack,
              'min-w-0',
            )}
          >
            {note === null ? null : (
              <span className="text-2xs text-muted-foreground" data-testid="artifact-creation-note">
                {note}
              </span>
            )}
            <ArtifactBriefField
              label={adapter.brief.label}
              placeholder={adapter.brief.placeholder}
              value={brief}
              goal={goal.editorText}
              isGoalPending={isGoalPending}
              defaultRequest={adapter.defaultRequest({ choice })}
              onChange={handle.setBrief}
              onSubmit={generate}
            />
            <ArtifactAttachmentsField
              attachments={attachments}
              worktree={files.worktree}
              isDragging={files.isDragging}
              note={files.note}
              composerRef={files.composerRef}
              fileInputRef={files.fileInputRef}
              onFileInputChange={files.onFileInputChange}
              onRemove={files.remove}
            />
            <section className="flex min-w-0 flex-col gap-2">
              <SectionHeader label={adapter.choice.label} />
              <ArtifactChoiceRows
                ariaLabel={adapter.choice.ariaLabel}
                options={adapter.choice.options}
                value={choice}
                onChange={handle.setChoice}
              />
            </section>
            {adapter.secondChoice === undefined ? null : (
              <section className="flex min-w-0 flex-col gap-2">
                <SectionHeader label={adapter.secondChoice.label} />
                <ArtifactChoiceRows
                  ariaLabel={adapter.secondChoice.ariaLabel}
                  options={adapter.secondChoice.options}
                  value={secondChoice}
                  onChange={handle.setSecondChoice}
                />
              </section>
            )}
            <ArtifactBasedOnField
              runs={runs}
              value={basedOn}
              scopeLine={
                basedOn.kind === 'workflow-run' ? adapter.scopeCopy.run : adapter.scopeCopy.session
              }
              repoLine={adapter.repoLine({ choice, repo })}
              onChange={setBasedOn}
            />
            <ArtifactContextDisclosure
              rows={inventory}
              truncations={preview.truncations}
              isCollecting={preview.status === 'collecting'}
              isOpen={isContextOpen}
              onOpenChange={setIsContextOpen}
            />
          </div>
        </ScrollFade>
        <ArtifactCreationFooter
          generateLabel={adapter.generateLabel}
          gate={gate}
          connectedProviders={connectedProviders}
          recommendation={recommendation}
          routing={routing}
          isStarting={isStarting}
          isDiscardArmed={isDiscardArmed}
          hasDraft={!isEmpty}
          error={error}
          onRouting={handle.setRouting}
          onCancel={onClose}
          onArmDiscard={() => setIsDiscardArmed(true)}
          onDisarmDiscard={() => setIsDiscardArmed(false)}
          onDiscard={() => {
            files.discardAll();
            clearArtifactDraft({ sessionId, kind });
            onClose();
          }}
          onGenerate={generate}
        />
      </div>
    </FocusedPane>
  );
};
