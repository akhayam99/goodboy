import { cn, InteractiveRow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useSummaryState } from '../../hooks/useSummaryState';

type Props = {
  readonly sessionId: SessionId;
};

export const SummaryStateLine = ({ sessionId }: Props) => {
  const state = useSummaryState({ sessionId });
  const openContextDrawer = useAppStore((store) => store.openContextDrawer);
  if (state === null) {
    return null;
  }
  const name = state.label === '' ? state.sentence : `${state.sentence}. ${state.label}`;
  return (
    <InteractiveRow
      label={`State: ${name}`}
      isSelected={false}
      onOpen={() => openContextDrawer({ sessionId, tab: 'summary' })}
      dataAttributes={{
        'data-summary-state': '',
        'data-stale': state.isStale ? (state.why ?? 'old') : 'false',
      }}
      className="flex min-w-0 items-baseline gap-2 px-1 py-0.5"
    >
      <span
        className={cn(
          'min-w-0 break-words text-body',
          state.isStale ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {state.sentence}
      </span>
      {state.label === '' ? null : (
        <span className="shrink-0 text-meta text-faint-foreground">{state.label}</span>
      )}
    </InteractiveRow>
  );
};
