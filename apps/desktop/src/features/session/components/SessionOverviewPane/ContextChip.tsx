import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Chip, StatusDot, Tooltip, chipClasses, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { selectNewDecisionCount } from '../../../../store/slices/contextDrawer/selectNewDecisionCount';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { withShortcutHint } from '../../../../shared/keyboard/registry';

type Props = {
  readonly sessionId: SessionId;
};

type TooltipParams = {
  readonly status: 'idle' | 'running' | 'error';
  readonly newCount: number;
};

const tooltipFor = ({ status, newCount }: TooltipParams): string => {
  if (status === 'running') {
    return 'Updating context';
  }
  if (status === 'error') {
    return "Couldn't update the context. Open to retry.";
  }
  return withShortcutHint({
    label:
      newCount > 0
        ? `${newCount} new ${newCount === 1 ? 'decision' : 'decisions'} since you last looked`
        : 'Goal, decisions and summary',
    shortcut: 'lens.context',
  });
};

export const ContextChip = ({ sessionId }: Props) => {
  const { status } = useSummarizerStatus(sessionId);
  const newCount = useAppStore((state) => selectNewDecisionCount({ state, sessionId }));
  const isOpen = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    return drawer !== null && drawer.kind === 'context' && drawer.sessionId === sessionId;
  });
  const toggleContextDrawer = useAppStore((state) => state.toggleContextDrawer);
  const loadSessionContextSeen = useAppStore((state) => state.loadSessionContextSeen);

  useEffect(() => {
    void loadSessionContextSeen(sessionId);
  }, [loadSessionContextSeen, sessionId]);

  const glyph =
    status === 'running' ? (
      <StatusDot tone="info" size="sm" pulsing ariaLabel="Updating context" />
    ) : status === 'error' ? (
      <AlertTriangle size={11} aria-hidden className="text-danger" />
    ) : (
      <CONCEPT_ICONS.context size={11} aria-hidden className="text-primary" />
    );

  return (
    <Tooltip content={tooltipFor({ status, newCount })}>
      <Chip
        as="button"
        tone="neutral"
        shape="badge"
        size="control"
        ariaPressed={isOpen}
        testId="context-chip"
        onClick={() =>
          toggleContextDrawer({ sessionId, ...(newCount > 0 && !isOpen && { tab: 'decisions' }) })
        }
        icon={glyph}
        label="Context"
        trailing={
          newCount > 0 ? (
            <span
              className={cn(
                chipClasses({ tone: 'primary', size: 'xs', bordered: false }),
                'tabular-nums',
              )}
            >
              {`${newCount} new`}
            </span>
          ) : null
        }
        className={cn(isOpen && 'bg-selected')}
      />
    </Tooltip>
  );
};
