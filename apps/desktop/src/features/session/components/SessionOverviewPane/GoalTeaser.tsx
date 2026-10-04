import { Skeleton, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionLoading, useSessionSlots } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { goalPresence } from './goalPresence';

type Props = {
  readonly session: Session;
};

const ROW =
  'flex min-w-0 items-center gap-2 rounded-md text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const GoalTeaser = ({ session }: Props) => {
  const sessionId = session.id;
  const slots = useSessionSlots(sessionId);
  const loading = useSessionLoading(sessionId);
  const openContextDrawer = useAppStore((state) => state.openContextDrawer);
  const goalSlot = slots.find((slot) => slot.key === 'goal');
  const value = goalSlot?.value ?? '';

  if (goalSlot === undefined && loading.slots) {
    return (
      <div role="status" aria-label="Loading goal" className="flex h-5 items-center">
        <Skeleton className="h-3 w-3/5" />
      </div>
    );
  }

  const presence = goalPresence({ value, sessionTitle: session.goal });
  const open = () => openContextDrawer({ sessionId, tab: 'goal' });

  if (presence === 'title') {
    return null;
  }

  if (presence === 'empty') {
    return (
      <button type="button" onClick={open} className={`${ROW} self-start px-1 py-0.5`}>
        <CONCEPT_ICONS.goal size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        <span className="text-meta text-muted-foreground">Add a goal</span>
      </button>
    );
  }

  const text = inlineMarkdownText({ text: value }).replace(/\s+/g, ' ').trim();

  return (
    <button
      type="button"
      onClick={open}
      aria-label={`Goal: ${text}`}
      title={text}
      className={`${ROW} w-full px-1 py-0.5`}
    >
      <span className="shrink-0 text-meta text-faint-foreground">Goal</span>
      <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">{text}</span>
    </button>
  );
};
