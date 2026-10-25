import { useEffect, useMemo, useRef, useState } from 'react';
import { TriangleAlert, Pause } from 'lucide-react';
import {
  AnchoredPopover,
  Button,
  cn,
  formatUsdPrecise,
  ICON_SIZE,
  tintClasses,
  Tooltip,
  useDropdown,
} from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { openImpactStudio } from '../../../impact/openImpactStudio';
import { SessionSpendPopover } from '../../../budget/components/SessionSpendPopover';
import { sessionSpendByAgent } from '../../../budget/sessionSpendByAgent';
import { sessionSpendPresentation } from '../../../budget/sessionSpendPresentation';
import { pendingSpendEdit } from '../../../budget/pendingSpendEdit';
import {
  requestSessionSpendLimitEdit,
  SESSION_SPEND_LIMIT_EDIT_EVENT,
} from '../../../budget/requestSessionSpendLimitEdit';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { manageDialogFocus } from './manageDialogFocus';
import { pickKeys } from '../../../../shared/utils/pickKeys';
import { sessionSpendLines } from '../../sessionSpendLines';

type Props = {
  readonly sessionId: SessionId;
  readonly placement?: 'line' | 'editHost';
};

const MIN_SHOWN_USD = 0.005;

const UNSPENT_LABEL = 'Set a limit';

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

export const SessionCostChip = ({ sessionId, placement = 'line' }: Props) => {
  const isEditHost = placement === 'editHost';
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
    align: 'start',
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
  const isUnspent = limit === null && spend.totalUsd < MIN_SHOWN_USD;
  const fullLabel = `${presentation.label}${presentation.ratio === null ? '' : ' limit'}`;
  const shownLabel = isUnspent ? UNSPENT_LABEL : presentation.compactLabel;
  const tooltip = isUnspent
    ? 'Nothing spent in this session yet. Set a limit'
    : limit === null
      ? `${formatUsdPrecise(spend.totalUsd)} spent in this session`
      : presentation.sentence;
  const textClass = isUnspent
    ? 'text-faint-foreground'
    : presentation.tone === 'neutral'
      ? 'text-muted-foreground'
      : tintClasses(presentation.tone).text;

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
    if (isEditHost) {
      return;
    }
    return sessionSpendLines.mount({ sessionId });
  }, [isEditHost, sessionId]);

  useEffect(() => {
    const onEditRequest = (event: Event) => {
      if (!isEditRequestFor({ event, sessionId })) {
        return;
      }
      if (isEditHost && sessionSpendLines.isShown({ sessionId })) {
        return;
      }
      if (!open) {
        toggle();
      }
      requestAnimationFrame(() => setIsEditing(true));
    };
    window.addEventListener(SESSION_SPEND_LIMIT_EDIT_EVENT, onEditRequest);
    return () => window.removeEventListener(SESSION_SPEND_LIMIT_EDIT_EVENT, onEditRequest);
  }, [isEditHost, open, sessionId, toggle]);

  useEffect(() => {
    if (!pendingSpendEdit.take({ sessionId })) {
      return;
    }
    requestAnimationFrame(() => requestSessionSpendLimitEdit({ sessionId }));
  }, [sessionId]);

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
    <Pause size={ICON_SIZE.mark} aria-hidden className="shrink-0" />
  ) : presentation.level === 'near' || presentation.level === 'over' ? (
    <TriangleAlert size={ICON_SIZE.mark} aria-hidden className="shrink-0" />
  ) : null;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Session spend"
      tabIndex={-1}
      className="flex max-h-[32rem] flex-col bg-subtle"
      anchorClassName="flex min-w-0"
      trigger={
        isEditHost ? (
          <span aria-hidden data-spend-edit-host="" className="block size-0" />
        ) : (
          <Tooltip content={tooltip} isSuppressed={open}>
            <Button
              ref={triggerRef}
              variant="quiet"
              size="sm"
              onClick={toggle}
              aria-haspopup="dialog"
              aria-expanded={open}
              aria-label={isUnspent ? UNSPENT_LABEL : `Spend ${fullLabel}`}
              data-level={presentation.level}
              data-tone={isUnspent ? 'faint' : presentation.tone}
              data-session-spend=""
              className={cn('w-full min-w-0 justify-start font-normal tabular-nums', textClass)}
            >
              {glyph}
              <span
                key={tick}
                className={cn('min-w-0 flex-1 truncate text-left', tick > 0 && 'cost-tick')}
              >
                {shownLabel}
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
            </Button>
          </Tooltip>
        )
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
