import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  Play,
  RotateCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Dialog, Divider, Markdown, Textarea, cn } from '@goodboy/ui';
import type { Agent, PlanId, PlanStatus, PlanWithCount, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionPlans } from '../../../../store';

const PLAN_STATUS_STYLE: Record<PlanStatus, string> = {
  active: 'bg-warning/10 text-warning',
  consumed: 'bg-info/10 text-info',
  superseded: 'bg-muted text-muted-foreground',
  discarded: 'bg-muted/60 text-muted-foreground/70 line-through',
};

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'Active',
  consumed: 'Consumed',
  superseded: 'Superseded',
  discarded: 'Discarded',
};

interface Props {
  readonly sessionId: SessionId;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly initialPlanId?: PlanId;
}

export function PlansModal({ sessionId, open, onClose, initialPlanId }: Props) {
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

  // Discarded plans are frozen, force preview, segmented control is
  // disabled below. If the user was editing when the plan got discarded
  // (or selected a discarded one), drop back to preview.
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

  // Soft delete, flips the plan to 'discarded' (status only, row stays).
  // If the user happens to be mid-edit, commit the draft first so their
  // typing isn't lost on restore. Selection stays on the plan: it's still
  // visible in the list (dimmed) so the user can immediately undo.
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

  const planList = (
    <ul className="flex w-full flex-col gap-1 overflow-y-auto">
      {plans.length === 0 ? (
        <li className="py-2 text-xs text-muted-foreground">No plans yet</li>
      ) : (
        plans.map((plan, idx) => {
          const isSel = plan.id === selectedId;
          const isDiscarded = plan.status === 'discarded';
          return (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => handleSelectPlan(plan.id)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors',
                  isSel ? 'bg-muted' : 'hover:bg-muted/40',
                  isDiscarded && 'opacity-60',
                )}
              >
                <div className="flex w-full items-center justify-between gap-1.5">
                  <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                    Plan {idx + 1}
                  </span>
                  <span
                    className={cn(
                      'inline-flex w-20 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-wide',
                      PLAN_STATUS_STYLE[plan.status],
                    )}
                  >
                    {PLAN_STATUS_LABEL[plan.status]}
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
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Plans"
      size="xl"
      fixedHeightClass="h-[92vh] max-w-[1400px]"
      className="w-[92vw] max-w-[1400px]"
      panel={planList}
      panelWidthClass="w-72"
      panelClassName="px-3 py-4"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {selected ? (
          <>
            <div className="flex shrink-0 items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-2xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} aria-hidden className="shrink-0 text-warning" />
                  <span>Created by</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (creatorDeleted) {
                        window.alert(
                          `Agent "${selectedAgentName}" has been deleted and can no longer be opened.`,
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
                      creatorDeleted ? 'Agent deleted, click for details' : 'Open creator agent'
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
                            window.alert(
                              `Agent "${displayName}" has been deleted and can no longer be opened.`,
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
                        title={isDeleted ? 'Agent deleted, click for details' : 'Open agent'}
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
              {/* Actions, left-to-right: segmented control → trigger → delete/restore.
                  Order intentionally inverted vs. older builds: the destructive
                  action sits at the far right so it's predictable to find. */}
              <div className="flex shrink-0 items-center gap-1.5">
                <div
                  role="tablist"
                  aria-label="Content mode"
                  className={cn(
                    'inline-flex items-center rounded-md border border-border-soft p-0.5',
                    selected.status === 'discarded' && 'opacity-50',
                  )}
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
                    title="Preview rendered markdown"
                  >
                    <Eye size={11} aria-hidden />
                    Preview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'edit'}
                    disabled={selected.status === 'discarded'}
                    onClick={() => setMode('edit')}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs transition',
                      mode === 'edit'
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                      selected.status === 'discarded' &&
                        'cursor-not-allowed hover:text-muted-foreground',
                    )}
                    title={
                      selected.status === 'discarded'
                        ? 'Discarded plans cannot be edited, restore first'
                        : 'Edit markdown source'
                    }
                  >
                    <Pencil size={11} aria-hidden />
                    Edit
                  </button>
                </div>
                {selected.status !== 'discarded' ? (
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
                        ? 'Already consumed, click again to confirm and spawn a fresh agent'
                        : selected.status === 'consumed' || selected.status === 'superseded'
                          ? 'Plan already ran, click to replay (asks for confirmation)'
                          : 'Spawn new agent to execute this plan'
                    }
                  >
                    {spawning ? (
                      <Loader2 size={12} aria-hidden className="animate-spin" />
                    ) : retriggerArmed ? (
                      <AlertTriangle size={12} aria-hidden />
                    ) : selected.status === 'active' ? (
                      <Play size={12} aria-hidden className="fill-current" />
                    ) : (
                      <RotateCw size={12} aria-hidden />
                    )}
                    {retriggerArmed
                      ? 'Already consumed, click again to confirm'
                      : selected.status === 'active'
                        ? 'Start'
                        : 'Replay'}
                  </button>
                ) : null}
                {selected.status === 'consumed' ? (
                  <span
                    className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-border-soft p-1.5 text-danger/30"
                    title="Consumed plans cannot be deleted"
                    aria-label="Consumed plans cannot be deleted"
                  >
                    <Trash2 size={13} aria-hidden />
                  </span>
                ) : selected.status === 'discarded' ? (
                  <button
                    type="button"
                    onClick={() => handleRestore(selected)}
                    title="Restore plan"
                    aria-label="Restore plan"
                    className="inline-flex items-center justify-center rounded-md border border-info/20 p-1.5 text-info transition hover:border-info/40 hover:bg-info/10"
                  >
                    <ArchiveRestore size={13} aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDiscard(selected)}
                    title="Delete plan (soft delete, click restore to recover)"
                    aria-label="Delete plan"
                    className="inline-flex items-center justify-center rounded-md border border-danger/20 p-1.5 text-danger transition hover:border-danger/40 hover:bg-danger/10"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                )}
              </div>
            </div>
            {/* Scroll container: only the body scrolls, header/actions above
                stay anchored. Top/bottom gradients fade content into the
                dialog bg, same trick used by the chat transcript. Border
                only in edit mode where the textarea needs a visible field. */}
            {/* Hairline separator between sticky header (created by + actions)
                and the scrollable body, with breathing room on both sides
                so the divider doesn't kiss the content. The fade gradients
                below kick in further down once the body starts scrolling. */}
            <div className="shrink-0 py-2">
              <Divider />
            </div>
            <div className="relative min-h-0 flex-1">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent" />
              <div
                className={cn(
                  'h-full overflow-y-auto',
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
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            No plan selected
          </div>
        )}
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
  const bodyMd = trimNewlines(restLines.join('\n'));
  return { title, bodyMd };
}

function trimNewlines(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s.charAt(start) === '\n') start++;
  while (end > start && s.charAt(end - 1) === '\n') end--;
  return s.slice(start, end);
}
