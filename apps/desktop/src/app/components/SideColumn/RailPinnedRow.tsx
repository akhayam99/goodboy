import { ROW_INTERACTIVE, Tooltip, cn, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionRowFacts } from '../../../features/workspace/hooks/useSessionRowFacts';
import { StateNode } from '../../../shared/components/StateNode';
import { useObjectMenuTrigger } from '../../../features/actions/useObjectMenuTrigger';

const PINNED_ROW =
  'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-meta text-muted-foreground hover:text-foreground';

type Props = {
  readonly session: Session;
  readonly isOpen: boolean;
  readonly onSelect: () => void;
};

export const RailPinnedRow = ({ session, isOpen, onSelect }: Props) => {
  const isCurrent = isOpen;
  const { node, title, unreadLabel } = useSessionRowFacts({ session });
  const menu = useObjectMenuTrigger({
    target: { kind: 'session', sessionId: session.id },
    anchorKey: `rail-pinned:${session.id}`,
  });
  return (
    <button
      type="button"
      data-rail-pinned={session.id}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={onSelect}
      className={cn(PINNED_ROW, ROW_INTERACTIVE, isCurrent && 'text-foreground')}
    >
      {unreadLabel === null ? (
        <StateNode node={node} />
      ) : (
        <Tooltip content={unreadLabel} side="right">
          <span className="inline-flex">
            <StateNode node={node} />
          </span>
        </Tooltip>
      )}
      <span className="min-w-0 flex-1 truncate">{inlineMarkdownText({ text: title })}</span>
    </button>
  );
};
