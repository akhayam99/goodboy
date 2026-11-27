import { Notice } from '@goodboy/ui';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';

export const FailedSourcesNotice = () => {
  const labels = useAppStore(
    useShallow((state) =>
      (state.calendarDay?.failedSources ?? []).map(
        (failure) =>
          state.calendarSources.find((source) => source.id === failure.sourceId)?.label ??
          'A calendar',
      ),
    ),
  );
  if (labels.length === 0) {
    return null;
  }
  return (
    <Notice
      tone="warning"
      placement="inline"
      role="status"
      title={`Couldn't read ${labels.join(', ')}`}
      body="The other calendars still show."
    />
  );
};
