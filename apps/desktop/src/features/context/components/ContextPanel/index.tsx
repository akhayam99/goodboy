import { useEffect, useState, useMemo } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Divider, ScrollFade, cn } from '@goodboy/ui';
import { SLOT_KEYS } from '@goodboy/core';
import type { ContextSlot, Session, SessionId, TelemetryRecord } from '@goodboy/types';
import { OpenQuestionsStrip } from '../OpenQuestionsStrip';
import { worktreeStatus } from '../../../../features/worktree/worktree';
import { TerminalDock } from '../../../../features/terminal/components/TerminalDock';
import {
  EMPTY_ARRAY,
  useAppStore,
  useFilesTouched,
  useSessionLoading,
  useSessionPlans,
  useSessionSlots,
  useSummarizerStatus,
} from '../../../../store';
import { ICON_BTN, normalizeFilesSlot, type PanelTab } from './lib';
import { TabStrip } from './parts/TabStrip';
import { SummarizerBadge } from './parts/SummarizerBadge';
import { ChangesStrip } from './strips/ChangesStrip';
import { SlotRow } from './SlotRow';

interface ContextPanelProps {
  session: Session;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  isActive?: boolean;
}

export function ContextPanel({
  session,
  collapsed = false,
  onCollapse,
  onExpand,
  isActive = true,
}: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const summarizer = useSummarizerStatus(session.id);
  const loading = useSessionLoading(session.id);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const sessionTelemetry = useAppStore(
    (s) => s.sessionTelemetry[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const plans = useSessionPlans(session.id);
  const loadSessionPlans = useAppStore((s) => s.loadSessionPlans);
  const [tab, setTab] = useState<PanelTab>('context');
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);

  useEffect(() => {
    if (!isActive) return;
    void loadSessionOpenQuestions(session.id);
  }, [isActive, session.id, loadSessionOpenQuestions]);

  useEffect(() => {
    if (!isActive) return;
    void loadSessionPlans(session.id);
  }, [isActive, session.id, loadSessionPlans]);

  const filesTouched = useFilesTouched(session.id, isActive);
  const loadDiffComments = useAppStore((s) => s.loadDiffComments);

  useEffect(() => {
    if (!isActive) return;
    void loadDiffComments(session.id);
  }, [isActive, session.id, loadDiffComments]);

  const summarizerTotals = useMemo(() => {
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let count = 0;
    for (const rec of sessionTelemetry) {
      if (rec.kind !== 'summarizer') continue;
      inputTokens += rec.inputTokens;
      outputTokens += rec.outputTokens;
      estimatedCostUsd += rec.estimatedCostUsd;
      count += 1;
    }
    return { inputTokens, outputTokens, estimatedCostUsd, count };
  }, [sessionTelemetry]);

  const workingDir = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);

  const reconcileSessionBranch = useAppStore((s) => s.reconcileSessionBranch);
  useEffect(() => {
    if (!isActive || !workingDir) return;
    let cancelled = false;
    worktreeStatus(workingDir)
      .then((status) => {
        if (!cancelled && status.branch) {
          void reconcileSessionBranch(session.id as SessionId, status.branch);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    isActive,
    workingDir,
    session.id,
    filesTouched.count,
    summarizer.lastUpdate,
    reconcileSessionBranch,
  ]);

  const slotsByKey = useMemo(
    () =>
      new Map<string, ContextSlot>(
        slots.map((s) => [
          s.key,
          s.key === 'files_touched' ? normalizeFilesSlot(s, workingDir) : s,
        ]),
      ),
    [slots, workingDir],
  );

  const visibleSlotKeys = useMemo(
    () =>
      SLOT_KEYS.filter((k) => k !== 'files_touched' && k !== 'open_questions').sort((a, b) => {
        const order: Record<string, number> = {
          goal: 0,
          decisions: 1,
          last_output_summary: 2,
        };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }),
    [],
  );

  const isTerminalOpen = useAppStore((s) => s.terminalSessions[session.id as SessionId] === 'open');
  const hasActivePlan = plans.some((p) => p.status === 'active');

  return (
    <>
      <div className={cn('flex h-full w-full justify-end pr-4 pt-4', !collapsed && 'hidden')}>
        <button
          type="button"
          onClick={onExpand}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onExpand?.();
            }
          }}
          title="expand context panel"
          aria-label="expand context panel"
          className={cn(
            'h-fit',
            ICON_BTN,
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
          )}
        >
          <PanelRightOpen size={13} aria-hidden />
        </button>
      </div>

      <div
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden rounded-[6px]',
          collapsed && 'hidden',
        )}
      >
        <div className="shrink-0 flex flex-col gap-0 px-3 pt-3 pb-0">
          <header className="flex items-center justify-between gap-1 px-1 pb-2">
            <TabStrip
              tab={tab}
              onPick={setTab}
              summarizerRunning={summarizer.status === 'running'}
              isTerminalOpen={isTerminalOpen}
            />
            <div className="flex shrink-0 items-center gap-1">
              <SummarizerBadge
                sessionId={session.id}
                status={summarizer.status}
                lastUpdate={summarizer.lastUpdate}
                error={summarizer.error}
                totals={summarizerTotals}
                canRetry={summarizer.lastAttempt !== null}
              />
              {onCollapse ? (
                <button
                  type="button"
                  onClick={onCollapse}
                  title="hide context panel"
                  aria-label="hide context panel"
                  className={ICON_BTN}
                >
                  <PanelRightClose size={13} aria-hidden />
                </button>
              ) : null}
            </div>
          </header>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'absolute inset-0 flex flex-col',
              tab !== 'terminal' && 'invisible pointer-events-none',
            )}
          >
            <TerminalDock sessionId={session.id} isActive={tab === 'terminal'} cwd={workingDir} />
          </div>
          {tab !== 'terminal' ? (
            <div
              key={tab}
              className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 motion-safe:animate-fade-in"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                <ScrollFade className="flex-1" viewportClassName="p-1">
                  <ul className="flex flex-col gap-2.5">
                    {visibleSlotKeys.slice(0, 1).map((key) => {
                      const slot = slotsByKey.get(key);
                      return (
                        <SlotRow
                          key={key}
                          sessionId={session.id}
                          slotKey={key}
                          slot={slot}
                          loading={loading.slots}
                          isSummarizing={summarizer.status === 'running'}
                          onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
                        />
                      );
                    })}

                    {visibleSlotKeys.slice(1).map((key) => {
                      const slot = slotsByKey.get(key);
                      return (
                        <SlotRow
                          key={key}
                          sessionId={session.id}
                          slotKey={key}
                          slot={slot}
                          loading={loading.slots}
                          isSummarizing={summarizer.status === 'running'}
                          onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
                        />
                      );
                    })}
                  </ul>
                </ScrollFade>
                <ChangesStrip
                  sessionId={session.id}
                  workingDir={workingDir}
                  filesTouched={filesTouched}
                  plans={plans}
                  plansLoading={loading.plans}
                  hasActivePlan={hasActivePlan}
                />
              </div>
            </div>
          ) : null}
        </div>

        <Divider />

        <OpenQuestionsStrip sessionId={session.id} />
      </div>
    </>
  );
}
