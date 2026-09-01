import { useCallback, useEffect, useState } from 'react';
import { ArchiveRestore, Eye, Pencil, Play, RotateCw, Trash2 } from 'lucide-react';
import {
  Button,
  Divider,
  HeaderBand,
  InlineConfirm,
  Markdown,
  ScrollFade,
  SegmentedTabs,
  Textarea,
  Tooltip,
  cn,
} from '@goodboy/ui';
import type { Agent, PlanWithCount, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { FocusedPane } from '../../../../shared/components/PaneShell/FocusedPane';
import { PANE_RHYTHM } from '@goodboy/ui';
import { PlanStatusChip } from './PlanStatusChip';
import { PlanProvenance } from './PlanProvenance';
import { PlanRailCard } from './PlanRailCard';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import { FinishedRegister } from '../../../../shared/components/FinishedRegister';

type Props = {
  readonly sessionId: SessionId;
};

export const PlanStudio = ({ sessionId }: Props) => {
  const plans = useSessionPlans(sessionId);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const planConsumptions = useAppStore((s) => s.planConsumptions);
  const loadConsumptionsForPlan = useAppStore((s) => s.loadConsumptionsForPlan);
  const updatePlanBody = useAppStore((s) => s.updatePlanBody);
  const deletePlan = useAppStore((s) => s.deletePlan);
  const restorePlan = useAppStore((s) => s.restorePlan);
  const runPlan = useAppStore((s) => s.runPlan);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const focusedPlanId = useAppStore((s) => s.focusedPlanId[sessionId] ?? null);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const { showToast } = useToast();
  const announceAgentStarted = useAgentStartedToast();

  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [draft, setDraft] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [replayArmed, setReplayArmed] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const selected: PlanWithCount | null = plans.find((p) => p.id === focusedPlanId) ?? null;

  useEffect(() => {
    if (selected) void loadConsumptionsForPlan(selected.id);
  }, [selected, loadConsumptionsForPlan]);

  useEffect(() => {
    if (selected && mode === 'preview') setDraft(planToSource(selected));
  }, [selected, mode]);

  useEffect(() => {
    if (selected?.status === 'discarded' && mode === 'edit') setMode('preview');
  }, [selected?.status, mode]);

  const commitEdit = useCallback(() => {
    if (!selected) return;
    const next = parsePlanSource(draft);
    if (next.title.length === 0) return;
    if (next.title === selected.title && next.bodyMd === selected.bodyMd) return;
    void updatePlanBody(sessionId, selected.id, next.title, next.bodyMd);
  }, [selected, draft, sessionId, updatePlanBody]);

  const flushEdit = useCallback(() => {
    if (mode === 'edit') commitEdit();
    setMode('preview');
  }, [mode, commitEdit]);

  const openAgent = (agentId: Agent['id']) => {
    flushEdit();
    void selectAgent(sessionId, agentId);
  };

  const handleTrigger = async () => {
    if (!selected || spawning) {
      return;
    }
    setSpawning(true);
    try {
      const agentId = await runPlan(sessionId, selected.id);
      flushEdit();
      announceAgentStarted({
        sessionId,
        agentId,
        title: 'Implementer started',
        message: 'An agent is running this plan. You can keep working.',
      });
    } finally {
      setSpawning(false);
    }
  };

  const handleDiscard = (plan: PlanWithCount) => {
    if (mode === 'edit') commitEdit();
    setMode('preview');
    void deletePlan(sessionId, plan.id);
  };

  const handleRestore = (plan: PlanWithCount) => {
    void restorePlan(sessionId, plan.id);
  };

  const consumptions = selected ? (planConsumptions[selected.id] ?? []) : [];
  const creatorAgent = selected ? agents.find((a) => a.id === selected.agentId) : null;
  const creatorDeleted = selected ? !creatorAgent : false;
  const selectedAgentName = selected ? (creatorAgent?.name ?? 'unknown agent') : '';

  const handleAgentClick = (agentId: Agent['id'], name: string, deleted: boolean) => {
    if (deleted) {
      showToast('info', `agent "${name}" was deleted and can no longer be opened`);
      return;
    }
    openAgent(agentId);
  };

  if (selected != null) {
    return (
      <FocusedPane lens="Plans" count={plans.length}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className={cn('flex shrink-0 flex-col gap-2', PANE_RHYTHM.body)}>
            <HeaderBand
              title={selected.title}
              meta={<PlanStatusChip status={selected.status} />}
              subtitle={
                <PlanProvenance
                  creatorName={selectedAgentName}
                  creatorAgentId={selected.agentId}
                  creatorDeleted={creatorDeleted}
                  createdAt={selected.createdAt}
                  consumptions={consumptions}
                  agents={agents}
                  onAgentClick={handleAgentClick}
                />
              }
              actions={
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {deleteArmed ? (
                    <InlineConfirm
                      role="danger"
                      icon={<Trash2 size={12} aria-hidden />}
                      title={`Delete "${selected.title}"?`}
                      description="Moves this plan to discarded plans, where it can still be restored."
                      confirmLabel={`Delete ${selected.title}`}
                      autoDisarmMs={4000}
                      onConfirm={() => {
                        handleDiscard(selected);
                        setDeleteArmed(false);
                      }}
                      onCancel={() => setDeleteArmed(false)}
                      className="shrink-0"
                    />
                  ) : replayArmed ? (
                    <InlineConfirm
                      role="alert"
                      icon={<RotateCw size={12} aria-hidden />}
                      title="Replay this plan?"
                      description="It already ran once. Replaying spawns a new agent to execute it again."
                      confirmLabel="Replay"
                      autoDisarmMs={4000}
                      isBusy={spawning}
                      onConfirm={async () => {
                        await handleTrigger();
                        setReplayArmed(false);
                      }}
                      onCancel={() => setReplayArmed(false)}
                      className="shrink-0"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      {selected.status !== 'discarded' ? (
                        selected.status === 'consumed' ? (
                          <Button
                            variant="warning"
                            emphasis="outline"
                            size="sm"
                            onClick={() => setReplayArmed(true)}
                            disabled={spawning}
                            title="Plan already ran, click to replay and confirm"
                            className={cn(spawning && 'cursor-not-allowed animate-border-pulse')}
                          >
                            <RotateCw size={12} aria-hidden />
                            Replay
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void handleTrigger()}
                            disabled={spawning}
                            className={cn(spawning && 'cursor-not-allowed animate-border-pulse')}
                            title={
                              selected.status === 'active'
                                ? 'Spawn new agent to execute this plan'
                                : 'Replay this plan'
                            }
                          >
                            {selected.status === 'active' ? (
                              <Play size={12} aria-hidden className="fill-current" />
                            ) : (
                              <RotateCw size={12} aria-hidden />
                            )}
                            {selected.status === 'active' ? 'Start' : 'Replay'}
                          </Button>
                        )
                      ) : null}
                      {selected.status === 'consumed' ? (
                        <Tooltip content="Consumed plans cannot be deleted">
                          <span
                            className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-border-soft p-1.5 text-danger/30"
                            aria-label="Consumed plans cannot be deleted"
                          >
                            <Trash2 size={13} aria-hidden />
                          </span>
                        </Tooltip>
                      ) : selected.status === 'discarded' ? (
                        <Tooltip content="Restore plan">
                          <button
                            type="button"
                            onClick={() => handleRestore(selected)}
                            aria-label="Restore plan"
                            className="inline-flex items-center justify-center rounded-md border border-info/20 p-1.5 text-info transition hover:border-info/40 hover:bg-info/10"
                          >
                            <ArchiveRestore size={13} aria-hidden />
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip content="Delete plan (soft delete, click restore to recover)">
                          <button
                            type="button"
                            onClick={() => setDeleteArmed(true)}
                            aria-label="Delete plan"
                            className="inline-flex items-center justify-center rounded-md border border-danger/20 p-1.5 text-danger transition hover:border-danger/40 hover:bg-danger/10"
                          >
                            <Trash2 size={13} aria-hidden />
                          </button>
                        </Tooltip>
                      )}
                    </div>
                  )}
                  <SegmentedTabs
                    ariaLabel="Content mode"
                    options={[
                      { value: 'preview', label: 'Preview', icon: Eye },
                      {
                        value: 'edit',
                        label: 'Edit',
                        icon: Pencil,
                        ...(selected.status === 'discarded' && {
                          hint: 'Restore the plan to edit it',
                        }),
                        disabled: selected.status === 'discarded',
                      },
                    ]}
                    value={mode}
                    onChange={(nextMode) => {
                      if (nextMode === 'preview' && mode === 'edit') {
                        commitEdit();
                      }
                      setMode(nextMode);
                    }}
                    size="sm"
                  />
                </div>
              }
            />
          </div>
          <Divider />
          <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
            <div className={cn(PANE_RHYTHM.column, PANE_RHYTHM.measure.pane)}>
              {mode === 'edit' ? (
                <Textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full font-mono text-xs"
                  autoGrow
                  minRows={12}
                  maxRows={80}
                />
              ) : (
                <Markdown text={selected.bodyMd} className="text-xs" />
              )}
            </div>
          </ScrollFade>
        </div>
      </FocusedPane>
    );
  }

  const active = plans.filter((plan) => plan.status === 'active');
  const consumed = plans.filter((plan) => plan.status !== 'active');
  const visibleConsumed = consumed.slice(0, 30);
  const earlierConsumed = consumed.slice(30);

  return (
    <PaneShell
      title="Plans"
      description="Plans agents drafted for this session. Run one to spawn an executor."
      meta={plans.length > 0 ? plans.length : undefined}
    >
      {plans.length === 0 ? (
        <LensEmptyState
          tone={CONCEPT_TONE.plans}
          icon={CONCEPT_ICONS.plans}
          title="No plans yet"
          description="Plans appear here once an agent drafts one. Run a planning agent to get started."
        />
      ) : null}
      {plans.length > 0 && active.length === 0 ? (
        <LensEmptyState
          tone={CONCEPT_TONE.plans}
          icon={CONCEPT_ICONS.plans}
          title="Nothing active"
          description="Every plan here already ran or was discarded. Finished plans remain below for reference."
        />
      ) : null}
      {active.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {active.map((plan) => (
            <li key={plan.id}>
              <PlanRailCard plan={plan} onSelect={() => setFocusedPlanId(sessionId, plan.id)} />
            </li>
          ))}
        </ul>
      ) : null}
      <FinishedRegister
        label="Finished"
        count={consumed.length}
        visible={
          <ul className="flex flex-col gap-2">
            {visibleConsumed.map((plan) => (
              <li key={plan.id}>
                <PlanRailCard plan={plan} onSelect={() => setFocusedPlanId(sessionId, plan.id)} />
              </li>
            ))}
          </ul>
        }
        earlierCount={earlierConsumed.length}
        earlier={
          <ul className="flex flex-col gap-2">
            {earlierConsumed.map((plan) => (
              <li key={plan.id}>
                <PlanRailCard plan={plan} onSelect={() => setFocusedPlanId(sessionId, plan.id)} />
              </li>
            ))}
          </ul>
        }
      />
    </PaneShell>
  );
};

function planToSource(plan: { title: string; bodyMd: string }): string {
  const head = plan.title.startsWith('#') ? plan.title : `# ${plan.title}`;
  return plan.bodyMd.length > 0 ? `${head}\n\n${plan.bodyMd}` : head;
}

function parsePlanSource(raw: string): { title: string; bodyMd: string } {
  const lines = raw.split('\n');
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] ?? '').trim().length > 0) {
      firstIdx = i;
      break;
    }
  }
  if (firstIdx === -1) return { title: '', bodyMd: '' };
  const titleLine = (lines[firstIdx] ?? '').trim();
  const title = titleLine.replace(/^#+\s*/, '').trim();
  const restLines = lines.slice(firstIdx + 1);
  let lo = 0;
  let hi = restLines.length;
  while (lo < hi && (restLines[lo] ?? '') === '') lo += 1;
  while (hi > lo && (restLines[hi - 1] ?? '') === '') hi -= 1;
  const bodyMd = restLines.slice(lo, hi).join('\n');
  return { title, bodyMd };
}
