import { Button, Chip, Notice, Skeleton, TruncatedText, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionLoading, useSessionSlots } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useGoalHint } from '../../hooks/useGoalHint';
import { useGoalFromWork } from '../../hooks/useGoalFromWork';
import { GoalFromWorkCard } from './GoalFromWorkCard';

type Props = {
  readonly session: Session;
};

const ROW =
  'flex min-w-0 items-center gap-2 rounded-md text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const GoalTeaser = ({ session }: Props) => {
  const sessionId = session.id;
  const hint = useGoalHint({ sessionId });
  const proposal = useGoalFromWork({ session });
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

  const isEmpty = value.trim() === '';
  const open = () => openContextDrawer({ sessionId, tab: 'goal' });

  if (proposal.isReading) {
    return (
      <span role="status" className="text-meta text-shimmer">
        Reading {proposal.readingCount} {proposal.readingCount === 1 ? 'issue' : 'issues'}
      </span>
    );
  }
  if (proposal.error !== null) {
    return (
      <Notice
        role="alert"
        placement="inline"
        tone="danger"
        title="Couldn't read linked work"
        body={proposal.error}
        actions={
          <Button size="sm" variant="secondary" onClick={() => void proposal.write()}>
            Retry
          </Button>
        }
      />
    );
  }
  if (proposal.sources !== null) {
    return (
      <GoalFromWorkCard
        session={session}
        sources={proposal.sources}
        linkedCount={proposal.linked.length}
        entry={proposal.entry}
        onRetry={() => void proposal.write()}
        onDismiss={() => {
          hint.dismiss();
          proposal.dismiss();
        }}
        onUsed={() => {
          hint.dismiss();
          proposal.dismiss();
        }}
      />
    );
  }
  if (isEmpty && proposal.linked.length > 0 && !hint.isDismissed) {
    const source = proposal.linked[0];
    return (
      <Notice
        tone="info"
        placement="inline"
        icon={CONCEPT_ICONS.goal}
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="shrink-0">Write the title and goal from</span>
            <Chip tone="neutral" kind="id" label={proposal.label} />
            {source !== undefined && source.title.trim() !== '' ? (
              <TruncatedText className="min-w-0 font-normal">{source.title}</TruncatedText>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button size="sm" onClick={() => void proposal.write()}>
              Write title and goal
            </Button>
            <Button variant="ghost" size="sm" onClick={hint.dismiss}>
              Not now
            </Button>
          </>
        }
      />
    );
  }
  if (isEmpty) {
    return (
      <button type="button" onClick={open} className={`${ROW} self-start py-0.5`}>
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
      data-overview-goal=""
      className={`${ROW} py-0.5`}
    >
      <span className="line-clamp-3 min-w-0 flex-1 text-body text-foreground">{text}</span>
    </button>
  );
};
