import { useCallback, useEffect, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  ClipboardList,
  Eye,
  List,
  Pencil,
  Play,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  Divider,
  EmptyState,
  Markdown,
  ScrollFade,
  SegmentedTabs,
  Textarea,
  Tooltip,
  cn,
} from '@goodboy/ui';
import type { Agent, PlanId, PlanWithCount, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { ConfirmableButton } from '../../../../shared/components/ConfirmableButton';
import { fmtTimestamp } from './fmtTimestamp';
import { planStatusBadge } from './planStatusBadge';
import { PlanListPanel } from './PlanListPanel';

type Props = {
  readonly sessionId: SessionId;
  readonly initialPlanId?: PlanId;
};

export const PlanStudio = ({ sessionId, initialPlanId }: Props) => {
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
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const { showToast } = useToast();

  const [selectedId, setSelectedId] = useState<PlanId | null>(initialPlanId ?? null);
  const [listOpen, setListOpen] = useState(false);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [draft, setDraft] = useState('');
  const [spawning, setSpawning] = useState(false);

  useEffect(() => {
    if (selectedId === null && plans.length > 0) {
      const fallback = plans[plans.length - 1];
      if (fallback) setSelectedId(fallback.id);
    }
  }, [selectedId, plans]);

  useEffect(() => {
    if (selectedId) void loadConsumptionsForPlan(selectedId);
  }, [selectedId, loadConsumptionsForPlan]);

  useEffect(() => {
    setFocusedPlanId(sessionId, selectedId);
  }, [sessionId, selectedId, setFocusedPlanId]);

  const selected: PlanWithCount | null = plans.find((p) => p.id === selectedId) ?? null;

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

  const handleSelectPlan = (id: PlanId) => {
    if (mode === 'edit') commitEdit();
    setMode('preview');
    setSelectedId(id);
    setListOpen(false);
  };

  const handleTrigger = async () => {
    if (!selected || spawning) {
      return;
    }
    setSpawning(true);
    try {
      await runPlan(sessionId, selected.id);
      flushEdit();
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

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 px-6 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <ClipboardList size={16} aria-hidden className="text-success" />
          </span>
          <div className="flex min-w-0 flex-col">
            <h1 className="text-xl font-semibold leading-snug text-foreground">Plans</h1>
            <p className="text-sm text-muted-foreground">
              Plans agents drafted for this session. Run one to spawn an executor.
            </p>
          </div>
        </div>
        {plans.length > 1 ? (
          <button
            type="button"
            onClick={() => setListOpen((open) => !open)}
            title="browse the other plans in this session"
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground',
              listOpen && 'bg-foreground/5 text-foreground',
            )}
          >
            <List size={13} aria-hidden />
            Other plans ({plans.length - 1})
          </button>
        ) : null}
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1">
        {plans.length === 0 ? (
          <div className="mx-auto w-full max-w-2xl px-6 py-5">
            <EmptyState
              bordered
              tone="success"
              icon={ClipboardList}
              title="No plans yet"
              description="Plans appear here once an agent drafts one. Run a planning agent to get started."
            />
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1">
              <div className="mx-auto flex h-full min-h-0 min-w-0 w-full max-w-3xl flex-col gap-2 px-6 py-4">
                {selected ? (
                  <>
                    <div className="flex shrink-0 items-start gap-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1 text-2xs text-muted-foreground">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="min-w-0 truncate text-sm font-medium text-foreground">
                            {selected.title}
                          </h2>
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] lowercase tracking-wide',
                              planStatusBadge({ status: selected.status }).className,
                            )}
                          >
                            {planStatusBadge({ status: selected.status }).label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={11} aria-hidden className="shrink-0 text-warning" />
                          <span>Created by</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (creatorDeleted) {
                                showToast(
                                  'info',
                                  `agent "${selectedAgentName}" was deleted and can no longer be opened`,
                                );
                                return;
                              }
                              openAgent(selected.agentId);
                            }}
                            className={cn(
                              'truncate font-medium underline-offset-2',
                              creatorDeleted
                                ? 'cursor-help text-muted-foreground line-through hover:text-foreground'
                                : 'text-foreground hover:underline',
                            )}
                            title={
                              creatorDeleted
                                ? 'Agent deleted, click for details'
                                : 'Open creator agent'
                            }
                          >
                            {selectedAgentName}
                          </button>
                          {creatorDeleted ? (
                            <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                              Deleted
                            </span>
                          ) : null}
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{fmtTimestamp(selected.createdAt)}</span>
                        </div>
                        {consumptions.map((c) => {
                          const ag = agents.find((a) => a.id === c.agentId);
                          const isDeleted = !ag;
                          const displayName = ag?.name ?? c.agentName ?? c.agentId.substring(0, 8);
                          return (
                            <div key={c.id} className="flex items-center gap-1.5">
                              <CheckCircle2 size={11} aria-hidden className="shrink-0 text-info" />
                              <span>Consumed by</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isDeleted) {
                                    showToast(
                                      'info',
                                      `agent "${displayName}" was deleted and can no longer be opened`,
                                    );
                                    return;
                                  }
                                  openAgent(c.agentId);
                                }}
                                className={cn(
                                  'truncate font-medium underline-offset-2',
                                  isDeleted
                                    ? 'cursor-help text-muted-foreground line-through hover:text-foreground'
                                    : 'text-foreground hover:underline',
                                )}
                                title={
                                  isDeleted ? 'Agent deleted, click for details' : 'Open agent'
                                }
                              >
                                {displayName}
                              </button>
                              {isDeleted ? (
                                <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                                  Deleted
                                </span>
                              ) : null}
                              <span aria-hidden>·</span>
                              <span className="shrink-0">{fmtTimestamp(c.consumedAt)}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <SegmentedTabs
                          ariaLabel="Content mode"
                          options={[
                            {
                              value: 'preview',
                              label: 'Preview',
                              icon: Eye,
                              hint: 'Preview rendered markdown',
                            },
                            {
                              value: 'edit',
                              label: 'Edit',
                              icon: Pencil,
                              hint:
                                selected.status === 'discarded'
                                  ? 'Discarded plans cannot be edited, restore first'
                                  : 'Edit markdown source',
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
                        {selected.status !== 'discarded' ? (
                          selected.status === 'consumed' ? (
                            <ConfirmableButton
                              key={selected.id}
                              label="Replay"
                              armedLabel="Confirm replay"
                              busyLabel="Replaying..."
                              onConfirm={handleTrigger}
                              disabled={spawning}
                              tone="warning"
                              autoDisarmMs={4000}
                              title="Plan already ran, click to replay and confirm"
                              icon={<RotateCw size={12} aria-hidden />}
                              className="rounded-md px-2.5 py-1 text-xs"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleTrigger()}
                              disabled={spawning}
                              className={cn(
                                'inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90',
                                spawning && 'cursor-not-allowed opacity-60 animate-border-pulse',
                              )}
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
                            </button>
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
                              onClick={() => handleDiscard(selected)}
                              aria-label="Delete plan"
                              className="inline-flex items-center justify-center rounded-md border border-danger/20 p-1.5 text-danger transition hover:border-danger/40 hover:bg-danger/10"
                            >
                              <Trash2 size={13} aria-hidden />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 py-2">
                      <Divider />
                    </div>
                    <ScrollFade
                      className={cn(
                        'min-h-0 flex-1',
                        mode === 'edit' && 'rounded-md border border-border-soft p-2',
                      )}
                    >
                      {mode === 'edit' ? (
                        <Textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-full w-full resize-none border-0 bg-transparent p-0 font-mono text-xs shadow-none focus-visible:shadow-none focus-visible:ring-0"
                        />
                      ) : (
                        <Markdown text={selected.bodyMd} className="text-xs" />
                      )}
                    </ScrollFade>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-6">
                    <EmptyState
                      bordered
                      tone="neutral"
                      icon={ClipboardList}
                      title="No plan selected"
                      description="Pick a plan from the list to preview, edit, or run it."
                    />
                  </div>
                )}
              </div>
            </div>
            {listOpen && plans.length > 1 ? (
              <PlanListPanel
                plans={plans}
                selectedId={selectedId}
                onSelect={handleSelectPlan}
                onClose={() => setListOpen(false)}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
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
