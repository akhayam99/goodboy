import { useEffect, useMemo, useRef, useState } from 'react';
import { Divider, Popover, ScrollFade, cn, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { SessionBudgetContent } from '../../../budget/components/BudgetStudio/SessionBudgetContent';
import type { WorkspaceTurn } from '../../../budget/components/BudgetStudio/lib';
import { useDropdown } from '../../../../shared/hooks/useDropdown';
import { DropdownPortal } from '../../../../shared/hooks/useDropdown/DropdownPortal';
import { EMPTY_ARRAY, useAppStore, useSessionCost } from '../../../../store';
import { manageDialogFocus } from './manageDialogFocus';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionCostChip = ({ sessionId }: Props) => {
  const sessionCost = useSessionCost(sessionId);
  const alertCapUsd = useAppStore(
    (state) =>
      state.budgetAlerts.find(
        (alert) =>
          alert.sessionId === sessionId &&
          (alert.kind === 'session-threshold' || alert.kind === 'session-exceeded'),
      )?.capUsd ?? null,
  );
  const telemetry = useAppStore((state) => state.sessionTelemetry[sessionId]);
  const session = useAppStore(
    (state) => state.sessions.find((candidate) => candidate.id === sessionId) ?? null,
  );
  const sessionBudget = useAppStore(
    (state) => state.sessionBudgets[sessionId]?.softCapUsd ?? alertCapUsd,
  );
  const loadSessionTelemetry = useAppStore((state) => state.loadSessionTelemetry);
  const loadSessionBudget = useAppStore((state) => state.loadSessionBudget);
  const setSessionBudget = useAppStore((state) => state.setSessionBudget);
  const { open, toggle, containerRef, popupRef, popupClassName, popupStyle, portal, portalTarget } =
    useDropdown({
      align: 'end',
      expectedHeight: 520,
      expectedWidth: 640,
      width: 'w-[40rem] max-w-[calc(100vw-2rem)]',
      strategy: 'fixed',
    });
  const spent = formatUsd(sessionCost);
  const label = sessionBudget != null ? `${spent} / ${formatUsd(sessionBudget)}` : spent;
  const title =
    sessionBudget != null
      ? `Estimated cost for this session: ${formatUsdPrecise(sessionCost)} of a ${formatUsdPrecise(sessionBudget)} cap (excluding summarizer), click for budget details`
      : `Estimated cost for this session: ${formatUsdPrecise(sessionCost)} (excluding summarizer), click for budget details`;
  const turns = useMemo<ReadonlyArray<WorkspaceTurn>>(
    () =>
      (telemetry ?? EMPTY_ARRAY).map((record) => ({
        record,
        sessionId,
        sessionGoal: session?.goal ?? 'Untitled session',
      })),
    [session?.goal, sessionId, telemetry],
  );
  const [pulse, setPulse] = useState(false);
  const prevCostRef = useRef(sessionCost);
  const prevSessionIdRef = useRef(sessionId);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      prevCostRef.current = sessionCost;
      setPulse(false);
      return;
    }
    if (prevCostRef.current === sessionCost) {
      return;
    }
    prevCostRef.current = sessionCost;
    setPulse(true);
  }, [sessionCost, sessionId]);

  useEffect(() => {
    if (open === false) {
      return;
    }
    void loadSessionTelemetry(sessionId);
    void loadSessionBudget(sessionId);
  }, [loadSessionBudget, loadSessionTelemetry, open, sessionId]);

  useEffect(() => {
    if (open === false || popupRef.current == null || triggerRef.current == null) {
      return;
    }
    return manageDialogFocus({
      dialog: popupRef.current,
      returnFocusTo: triggerRef.current,
    });
  }, [open, popupRef]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={title}
        onAnimationEnd={() => setPulse(false)}
        className={cn(
          'inline-flex shrink-0 items-center rounded-md border border-border-soft bg-muted px-2 py-1 font-mono text-2xs tabular-nums text-muted-foreground transition-colors hover:border-border hover:text-foreground',
          pulse && 'cost-chip-pulse',
        )}
      >
        {label}
      </button>
      <DropdownPortal portal={portal} portalTarget={portalTarget}>
        {open ? (
          <Popover
            innerRef={popupRef}
            role="dialog"
            ariaLabel="session budget details"
            tabIndex={-1}
            className={cn(popupClassName, 'flex max-h-[32rem] flex-col bg-subtle')}
            style={popupStyle}
          >
            <div className="flex flex-col gap-0.5 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Session budget</span>
              <span className="truncate text-2xs text-muted-foreground">
                {session?.goal ?? 'Untitled session'}
              </span>
            </div>
            <Divider />
            <ScrollFade className="min-h-0 flex-1" viewportClassName="p-4">
              <SessionBudgetContent
                turns={turns}
                softCapUsd={sessionBudget}
                onSaveCap={(nextCapUsd) => setSessionBudget(sessionId, nextCapUsd)}
              />
            </ScrollFade>
          </Popover>
        ) : null}
      </DropdownPortal>
    </div>
  );
};
