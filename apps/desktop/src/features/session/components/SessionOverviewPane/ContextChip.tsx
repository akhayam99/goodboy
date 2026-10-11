import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Chip, StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { selectHasContextChange } from '../../../../store/slices/contextDrawer/selectHasContextChange';
import type { ShortcutId } from '../../../../shared/keyboard/registry';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
};

type TooltipParams = {
  readonly status: 'idle' | 'running' | 'error';
  readonly hasChange: boolean;
};

type TooltipCopy = {
  readonly content: string;
  readonly shortcut?: ShortcutId;
};

const tooltipFor = ({ status, hasChange }: TooltipParams): TooltipCopy => {
  if (status === 'running') {
    return { content: 'Updating context' };
  }
  if (status === 'error') {
    return { content: "Couldn't update the context. Open to retry." };
  }
  return {
    content: hasChange ? 'Decisions changed since you last looked' : 'Goal, decisions and summary',
    shortcut: 'lens.context',
  };
};

export const ContextChip = ({ sessionId }: Props) => {
  const { status } = useSummarizerStatus(sessionId);
  const isOpen = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    return drawer !== null && drawer.kind === 'context' && drawer.sessionId === sessionId;
  });
  const hasChange = useAppStore((state) => !isOpen && selectHasContextChange({ state, sessionId }));
  const hasLedger = useAppStore((state) => state.sessionDecisions[sessionId] !== undefined);
  const toggleContextDrawer = useAppStore((state) => state.toggleContextDrawer);
  const loadSessionContextSeen = useAppStore((state) => state.loadSessionContextSeen);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);

  useEffect(() => {
    void loadSessionContextSeen(sessionId);
  }, [loadSessionContextSeen, sessionId]);

  useEffect(() => {
    if (hasLedger) {
      return;
    }
    void loadSessionDecisions(sessionId);
  }, [hasLedger, loadSessionDecisions, sessionId]);

  const glyph =
    status === 'running' ? (
      <StatusDot tone="info" size="sm" pulsing ariaLabel="Updating context" />
    ) : status === 'error' ? (
      <AlertTriangle size={ICON_SIZE.mark} aria-hidden className="text-danger" />
    ) : (
      <CONCEPT_ICONS.context size={ICON_SIZE.mark} aria-hidden className="text-primary" />
    );

  return (
    <Tooltip {...tooltipFor({ status, hasChange })}>
      <Chip
        as="button"
        tone="neutral"
        shape="badge"
        kind="reference"
        ariaPressed={isOpen}
        testId="context-chip"
        onClick={() =>
          toggleContextDrawer({ sessionId, ...(hasChange && !isOpen && { tab: 'decisions' }) })
        }
        icon={glyph}
        label="Context"
        trailing={
          hasChange ? (
            <span
              role="img"
              aria-label="Changed since you last looked"
              data-testid="context-change-dot"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          ) : null
        }
        className={cn(isOpen && 'bg-selected')}
      />
    </Tooltip>
  );
};
