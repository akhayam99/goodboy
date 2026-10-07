import { Button, EmptyLine, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { ActivityView } from '../../../../timeline/activityView';

type Props = {
  readonly view: ActivityView;
  readonly isSearching: boolean;
  readonly hasLogEntries: boolean;
  readonly onSeeLog: () => void;
  readonly onClearSearch: () => void;
};

export const TimelineEmpty = ({
  view,
  isSearching,
  hasLogEntries,
  onSeeLog,
  onClearSearch,
}: Props) => {
  if (isSearching) {
    return (
      <EmptyLine
        className="px-3"
        action={
          <Button variant="ghost" size="xs" onClick={onClearSearch}>
            Clear search
          </Button>
        }
      >
        No log entries match this search.
      </EmptyLine>
    );
  }
  if (view === 'log') {
    return (
      <EmptyState
        className="px-3"
        icon={CONCEPT_ICONS.timeline}
        title="No log entries yet"
        description="Plans, branch events and pull requests are recorded here."
      />
    );
  }
  return (
    <EmptyState
      className="px-3"
      icon={CONCEPT_ICONS.timeline}
      title="No runs or agents yet"
      description="Start a run or an agent to work on this session."
      action={
        hasLogEntries ? (
          <Button variant="ghost" size="xs" onClick={onSeeLog}>
            See Log
          </Button>
        ) : undefined
      }
    />
  );
};
