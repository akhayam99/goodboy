import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Dialog, Markdown, Textarea, cn } from '@goodboy/ui';
import type { Agent, PlanId, PlanStatus, PlanWithCount, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../../store';

const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  active: 'bg-warning/10 text-warning',
  consumed: 'bg-info/10 text-info',
  superseded: 'bg-muted text-muted-foreground',
};

interface PlansModalProps {
  readonly sessionId: SessionId;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialPlanId?: PlanId;
}

export function PlansModal({ sessionId, open, onClose, initialPlanId }: PlansModalProps) {
  const plans = useSessionPlans(sessionId);
  const agents = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const planConsumptions = useAppStore((s) => s.planConsumptions);
  const loadConsumptionsForPlan = useAppStore((s) => s.loadConsumptionsForPlan);
  const updatePlanBody = useAppStore((s) => s.updatePlanBody);
  const deletePlan = useAppStore((s) => s.deletePlan);
  const runPlan = useAppStore((s) => s.runPlan);
  const abandonPlan = useAppStore((s) => s.abandonPlan);
  const selectAgent = useAppStore((s) => s.selectAgent);

  const [selectedId, setSelectedId] = useState<PlanId | null>(initialPlanId ?? null);
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [draft, setDraft] = useState('');
  const [spawning, setSpawning] = useState(false);
  const [retriggerArmed, setRetriggerArmed] = useState(false);
  const retriggerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setRetriggerArmed(false);
    if (retriggerTimerRef.current !== null) {
      window.clearTimeout(retriggerTimerRef.current);
      retriggerTimerRef.current = null;
    }
  }, [selectedId, open]);

  useEffect(() => {
    return () => {
      if (retriggerTimerRef.current !== null) window.clearTimeout(retriggerTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (open && initialPlanId) setSelectedId(initialPlanId);
  }, [open, initialPlanId]);

  useEffect(() => {
    if (!open) return;
    if (selectedId === null && plans.length > 0) {
      const fallback = plans[plans.length - 1];
      if (fallback) setSelectedId(fallback.id);
    }
  }, [open, selectedId, plans]);

  useEffect(() => {
    if (open && selectedId) void loadConsumptionsForPlan(selectedId);
  }, [open, selectedId, loadConsumptionsForPlan]);

  const selected: PlanWithCount | null = plans.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (selected && mode === 'preview') setDraft(planToSource(selected));
  }, [selected, mode]);

  const commitEdit = useCallback(() => {
    if (!selected) return;
    const next = parsePlanSource(draft);
    if (next.title.length === 0) return;
    if (next.title === selected.title && next.bodyMd === selected.bodyMd) return;
    void updatePlanBody(sessionId, selected.id, next.title, next.bodyMd);
  }, [selected, draft, sessionId, updatePlanBody]);

  const handleClose = useCallback(() => {
    if (mode === 'edit') commitEdit();
    setMode('preview');
    onClose();
  }, [mode, commitEdit, onClose]);

  const handleSelectPlan = (id: PlanId) => {
    if (mode === 'edit') commitEdit();
    setMode('preview');
    setSelectedId(id);
  };

  const handleTrigger = async () => {
    if (!selected || spawning) return;
    if (selected.status === 'consumed' && !retriggerArmed) {
      setRetriggerArmed(true);
      if (retriggerTimerRef.current !== null) window.clearTimeout(retriggerTimerRef.current);
      retriggerTimerRef.current = window.setTimeout(() => {
        setRetriggerArmed(false);
        retriggerTimerRef.current = null;
      }, 4000);
      return;
    }
    if (retriggerTimerRef.current !== null) {
      window.clearTimeout(retriggerTimerRef.current);
      retriggerTimerRef.current = null;
    }
    setRetriggerArmed(false);
    setSpawning(true);
    try {
      await runPlan(sessionId, selected.id);
      handleClose();
    } finally {
      setSpawning(false);
    }
  };

  const handleDelete = (plan: PlanWithCount) => {
    if (!window.confirm(`delete plan "${plan.title}"? this cannot be undone.`)) return;
    const remaining = plans.filter((p) => p.id !== plan.id);
    void deletePlan(sessionId, plan.id);
    if (selectedId === plan.id) {
      setSelectedId(remaining[remaining.length - 1]?.id ?? null);
    }
  };

  const consumptions = selected ? (planConsumptions[selected.id] ?? []) : [];
  const creatorAgent = selected ? agents.find((a) => a.id === selected.agentId) : null;
  const creatorDeleted = selected ? !creatorAgent : false;
  const selectedAgentName = selected ? (creatorAgent?.name ?? 'unknown buddy') : '';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Plans"
      size="xl"
      fixedHeightClass="h-[92vh] max-w-[1400px]"
      className="w-[92vw] max-w-[1400px]"
    >
      <div className="flex h-full min-h-0 gap-3">
        <ul className="w-72 shrink-0 overflow-y-auto border-r border-border pr-3">
          {plans.length === 0 ? (
            <li className="py-2 text-xs text-muted-foreground">no plans yet</li>
          ) : (
            plans.map((plan, idx) => {
              const isSel = plan.id === selectedId;
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectPlan(plan.id)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left',
                      isSel ? 'bg-muted' : 'hover:bg-muted/40',
                    )}
                  >
                    <div className="flex w-full items-center gap-1.5">
                      <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                        plan {idx + 1}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide',
                          PLAN_STATUS_STYLE[plan.status],
                        )}
                      >
                        {plan.status}
                      </span>
                    </div>
                    <span className="line-clamp-2 text-xs text-foreground">{plan.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtTimestamp(plan.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {selected ? (
            <>
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-2xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={11} aria-hidden className="shrink-0 text-warning" />
                    <span>created by</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (creatorDeleted) {
                          window.alert(
                            `buddy "${selectedAgentName}" has been deleted and can no longer be opened.`,
                          );
                          return;
                        }
                        void selectAgent(sessionId, selected.agentId);
                        handleClose();
                      }}
                      className={cn(
                        'truncate font-medium underline-offset-2',
                        creatorDeleted
                          ? 'cursor-help text-muted-foreground line-through hover:text-foreground'
                          : 'text-foreground hover:underline',
                      )}
                      title={
                        creatorDeleted ? 'buddy deleted, click for details' : 'open creator buddy'
                      }
                    >
                      {selectedAgentName}
                    </button>
                    {creatorDeleted ? (
                      <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                        deleted
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
                        <span>consumed by</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isDeleted) {
                              window.alert(
                                `buddy "${displayName}" has been deleted and can no longer be opened.`,
                              );
                              return;
                            }
                            void selectAgent(sessionId, c.agentId);
                            handleClose();
                          }}
                          className={cn(
                            'truncate font-medium underline-offset-2',
                            isDeleted
                              ? 'cursor-help text-muted-foreground line-through hover:text-foreground'
                              : 'text-foreground hover:underline',
                          )}
                          title={isDeleted ? 'buddy deleted, click for details' : 'open buddy'}
                        >
                          {displayName}
                        </button>
                        {isDeleted ? (
                          <span className="shrink-0 rounded-sm bg-muted px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                            deleted
                          </span>
                        ) : null}
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{fmtTimestamp(c.consumedAt)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleTrigger()}
                    disabled={spawning}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition',
                      retriggerArmed
                        ? 'animate-pulse bg-danger text-danger-foreground hover:bg-danger/90'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90',
                      spawning && 'cursor-not-allowed opacity-60',
                    )}
                    title={
                      retriggerArmed
                        ? 'click again to confirm retrigger'
                        : selected.status === 'consumed'
                          ? 'plan already consumed. click to retrigger (asks for confirmation)'
                          : 'spawn new buddy to execute this plan'
                    }
                  >
                    {spawning ? (
                      <Loader2 size={12} aria-hidden className="animate-spin" />
                    ) : retriggerArmed ? (
                      <AlertTriangle size={12} aria-hidden />
                    ) : (
                      <Play size={12} aria-hidden className="fill-current" />
                    )}
                    {retriggerArmed
                      ? 'already consumed. click again to confirm'
                      : selected.status === 'consumed'
                        ? 'retrigger plan'
                        : 'trigger plan'}
                  </button>
                  {selected.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => void abandonPlan(sessionId, selected.id)}
                      className="rounded-md border border-border-soft px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      abandon
                    </button>
                  ) : null}
                  <div className="mx-0.5 h-5 w-px bg-border-soft" aria-hidden />
                  <div
                    role="tablist"
                    aria-label="content mode"
                    className="inline-flex items-center rounded-md border border-border-soft p-0.5"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'preview'}
                      onClick={() => {
                        if (mode === 'edit') commitEdit();
                        setMode('preview');
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs transition',
                        mode === 'preview'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title="preview rendered markdown"
                    >
                      <Eye size={11} aria-hidden />
                      preview
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'edit'}
                      onClick={() => setMode('edit')}
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs transition',
                        mode === 'edit'
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      title="edit markdown source"
                    >
                      <Pencil size={11} aria-hidden />
                      edit
                    </button>
                  </div>
                  {selected.status === 'consumed' ? (
                    <span
                      className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-border-soft p-1.5 text-danger/30"
                      title="consumed plans cannot be deleted"
                      aria-label="consumed plans cannot be deleted"
                    >
                      <Trash2 size={13} aria-hidden />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDelete(selected)}
                      title="delete plan"
                      aria-label="delete plan"
                      className="inline-flex items-center justify-center rounded-md border border-danger/20 p-1.5 text-danger transition hover:border-danger/40 hover:bg-danger/10"
                    >
                      <Trash2 size={13} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-soft p-2">
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
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
              no plan selected
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function fmtTimestamp(ts: string | number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const bodyMd = restLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
  return { title, bodyMd };
}
