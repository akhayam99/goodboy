import { useAppStore } from '../../../../store';
import { CalendarProblem } from './CalendarProblem';
import { MacAccessLostNotice } from './MacAccessLostNotice';

type Props = {
  readonly onRetry: () => Promise<void>;
};

const FALLBACK_LABEL = 'A calendar';

export const FailedSourcesNotice = ({ onRetry }: Props) => {
  const failures = useAppStore((state) => state.calendarDay?.failedSources);
  const sources = useAppStore((state) => state.calendarSources);
  if (failures === undefined || failures.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {failures.map((failure) => {
        const label = sources.find((source) => source.id === failure.sourceId)?.label;
        const name = label ?? FALLBACK_LABEL;
        return failure.kind === 'no_access' ? (
          <MacAccessLostNotice key={failure.sourceId} label={name} onReconnected={onRetry} />
        ) : (
          <CalendarProblem
            key={failure.sourceId}
            title={`Couldn't read ${name}`}
            body={failure.message}
            onRetry={onRetry}
          />
        );
      })}
    </div>
  );
};
