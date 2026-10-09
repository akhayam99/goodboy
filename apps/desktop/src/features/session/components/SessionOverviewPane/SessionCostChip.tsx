import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Pause } from 'lucide-react';
import {
  AnchoredPopover,
  chipClasses,
  cn,
  formatUsdPrecise,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { openImpactStudio } from '../../../impact/openImpactStudio';
import { SessionSpendPopover } from '../../../budget/components/SessionSpendPopover';
import { sessionSpendByAgent } from '../../../budget/sessionSpendByAgent';
import { sessionSpendPresentation } from '../../../budget/sessionSpendPresentation';
import { SESSION_SPEND_LIMIT_EDIT_EVENT } from '../../../budget/requestSessionSpendLimitEdit';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { manageDialogFocus } from './manageDialogFocus';
import { pickKeys } from '../../../../shared/utils/pickKeys';

type Props = {
  readonly sessionId: SessionId;
};

type EditRequestParams = {
  readonly event: Event;
  readonly sessionId: SessionId;
};

const isEditRequestFor = ({ event, sessionId }: EditRequestParams): boolean => {
  if (!(event instanceof CustomEvent)) {
    return false;
  }
  const detail: unknown = event.detail;
  return (
    typeof detail === 'object' &&
    detail !== null &&
    'sessionId' in detail &&
    detail.sessionId === sessionId
  );
};

export const SessionCostChip = ({ sessionId }: Props) => {
  const records = useAppStore((state) => state.sessionTelemetry[sessionId] ?? EMPTY_ARRAY);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const agentIds = useMemo(() => agents.map((agent) => agent.id), [agents]);
  const agentRunHistory = useAppStore(
    useShallow((state) => pickKeys({ source: state.agentRunHistory, keys: agentIds })),
  );
  const agentKindOverride = useAppStore(
    useShallow((state) => pickKeys({ source: state.agentKindOverride, keys: agentIds })),
  );
  const limit = useAppStore((state) => state.sessionBudgets[sessionId] ?? null);
  const loadSessionTelemetry = useAppStore((state) => state.loadSessionTelemetry);
  const loadSessionBudget = useAppStore((state) => state.loadSessionBudget);
  const dropdown = useDropdown({
    align: 'end',
    expectedHeight: 480,
    expectedWidth: 400,
    width: 'w-96 max-w-[calc(100vw-2rem)]',
  });
  const { open, toggle, close, popupRef } = dropdown;
  const [isEditing, setIsEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousTotalRef = useRef<number | null>(null);

  const spend = useMemo(
    () => sessionSpendByAgent({ records, agents, agentRunHistory, agentKindOverride }),
    [agentKindOverride, agentRunHistory, agents, records],
  );
  const presentation = sessionSpendPresentation({ totalUsd: spend.totalUsd, limit });
  const fill = Math.min(presentation.ratio ?? 0, 1) * 100;

  useEffect(() => {
    const previous = previousTotalRef.current;
    previousTotalRef.current = spend.totalUsd;
    if (previous === null || previous === spend.totalUsd) {
      return;
    }
    setTick((count) => count + 1);
  }, [spend.totalUsd]);

  useEffect(() => {
    void loadSessionBudget(sessionId);
  }, [loadSessionBudget, sessionId]);

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      return;
    }
    void loadSessionTelemetry(sessionId);
  }, [loadSessionTelemetry, open, sessionId]);

  useEffect(() => {
    const onEditRequest = (event: Event) => {
      if (!isEditRequestFor({ event, sessionId })) {
        return;
      }
      if (!open) {
        toggle();
      }
      requestAnimationFrame(() => setIsEditing(true));
    };
    window.addEventListener(SESSION_SPEND_LIMIT_EDIT_EVENT, onEditRequest);
    return () => window.removeEventListener(SESSION_SPEND_LIMIT_EDIT_EVENT, onEditRequest);
  }, [open, sessionId, toggle]);

  useEffect(() => {
    if (!open || popupRef.current == null || triggerRef.current == null) {
      return;
    }
    return manageDialogFocus({
      dialog: popupRef.current,
      returnFocusTo: triggerRef.current,
    });
  }, [open, popupRef]);

  const openInImpact = () => {
    openImpactStudio({ scope: { kind: 'session', sessionId } });
    close();
  };

  const glyph = presentation.isPaused ? (
    <Pause size={11} aria-hidden className="shrink-0" />
  ) : presentation.level === 'near' || presentation.level === 'over' ? (
    <AlertTriangle size={11} aria-hidden className="shrink-0" />
  ) : null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Session spend"
      tabIndex={-1}
      className="flex max-h-[32rem] flex-col bg-subtle"
      trigger={
        <button
          ref={triggerRef}
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Spend ${presentation.label}`}
          title={`${formatUsdPrecise(spend.totalUsd)} spent in this session`}
          data-level={presentation.level}
          className={cn(
            chipClasses({
              tone: presentation.tone,
              shape: 'badge',
              size: 'control',
              isInteractive: true,
            }),
            'overflow-hidden font-mono tabular-nums',
          )}
        >
          {glyph}
          <span key={tick} className={tick > 0 ? 'cost-tick' : undefined}>
            {presentation.label}
          </span>
          {presentation.ratio === null ? null : (
            <span
              aria-hidden
              data-slot="spend-bar"
              className="h-[3px] w-7 shrink-0 overflow-hidden rounded-full bg-fill"
            >
              <span
                className={cn(
                  'block h-full rounded-full',
                  presentation.tone === 'neutral'
                    ? 'bg-primary'
                    : tintClasses(presentation.tone).solid,
                )}
                style={{ width: `${fill}%` }}
              />
            </span>
          )}
        </button>
      }
    >
      <SessionSpendPopover
        sessionId={sessionId}
        spend={spend}
        limit={limit}
        isEditing={isEditing}
        onEditingChange={setIsEditing}
        onOpenImpact={openInImpact}
      />
    </AnchoredPopover>
  );
};
