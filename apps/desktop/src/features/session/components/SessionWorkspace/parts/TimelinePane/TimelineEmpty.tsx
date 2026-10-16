import { Button, EmptyLine, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { ActivityView } from '../../../../timeline/activityView';

type Props = {
  readonly view: ActivityView;
  readonly isSearching: boolean;
  readonly onClearSearch: () => void;
};

export const TimelineEmpty = ({ view, isSearching, onClearSearch }: Props) => {
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
  return <EmptyLine>Nothing ran yet</EmptyLine>;
};
