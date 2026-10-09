import { ROW_INTERACTIVE, cn, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { sessionNodeOf } from '../../../features/workspace/components/SessionActivityBar/sessionNode';
import { SessionStateNode } from '../../../features/workspace/components/SessionActivityBar/SessionStateNode';
import { useSessionSummary } from '../../../features/workspace/hooks/useSessionSummary';
import { sessionRowTitle } from '../../../features/session/sessionTitle';

const PINNED_ROW =
  'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-label text-muted-foreground hover:text-foreground';

type Props = {
  readonly session: Session;
  readonly isOpen: boolean;
  readonly onSelect: () => void;
};

export const RailPinnedRow = ({ session, isOpen, onSelect }: Props) => {
  const isCurrent = isOpen;
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({ info: summary.info, isArchived: false });
  const { title } = sessionRowTitle({ session, tasks: summary.tasks });
  return (
    <button
      type="button"
      data-rail-pinned={session.id}
      aria-current={isCurrent ? 'page' : undefined}
      onClick={onSelect}
      className={cn(PINNED_ROW, ROW_INTERACTIVE, isCurrent && 'text-foreground')}
    >
      <SessionStateNode node={node} />
      <span className="min-w-0 flex-1 truncate">{inlineMarkdownText({ text: title })}</span>
    </button>
  );
};
