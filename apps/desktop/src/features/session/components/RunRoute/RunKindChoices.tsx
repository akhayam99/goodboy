import { ROW_INTERACTIVE, SegmentedTabs, cn } from '@goodboy/ui';
import type { RunRouteCloseness, WorkflowId } from '@goodboy/types';
import type { RunRouteChoice } from '../../startRun/changeRunRoute';
import { RUN_ROUTE_COPY } from '../../startRun/runRouteCopy';
import type { RunKindChoice } from './runKindChoicesOf';

type ChooseParams = {
  readonly choice: RunRouteChoice;
};

type Props = {
  readonly choices: ReadonlyArray<RunKindChoice>;
  readonly closeness: RunRouteCloseness | null;
  readonly presetId: WorkflowId | null;
  readonly hasStarted: boolean;
  readonly isBusy: boolean;
  readonly onChoose: (params: ChooseParams) => void;
};

const CLOSENESS_KEYS: ReadonlyArray<RunRouteCloseness> = ['follow', 'adapt'];

export const RunKindChoices = ({
  choices,
  closeness,
  presetId,
  hasStarted,
  isBusy,
  onChoose,
}: Props) => {
  const heading = hasStarted ? RUN_ROUTE_COPY.startNewAs : RUN_ROUTE_COPY.changeTo;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {closeness === null || presetId === null ? null : (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-meta text-faint-foreground">{RUN_ROUTE_COPY.withPreset}</span>
          <SegmentedTabs<RunRouteCloseness>
            fill
            size="xs"
            ariaLabel={RUN_ROUTE_COPY.withPreset}
            options={CLOSENESS_KEYS.map((key) => ({
              value: key,
              label: RUN_ROUTE_COPY.closeness[key],
              disabled: isBusy,
            }))}
            value={closeness}
            onChange={(next) => onChoose({ choice: { shape: 'plan', presetId, closeness: next } })}
          />
        </div>
      )}
      {choices.length === 0 ? null : (
        <div role="group" aria-label={heading} className="flex min-w-0 flex-col gap-1">
          <span aria-hidden className="text-label text-muted-foreground">
            {heading}
          </span>
          <ul className="flex min-w-0 flex-col">
            {choices.map((entry) => (
              <li key={entry.key} className="flex min-w-0">
                <button
                  type="button"
                  disabled={isBusy}
                  data-run-kind-choice={entry.key}
                  onClick={() => onChoose({ choice: entry.choice })}
                  className={cn(
                    'flex min-w-0 flex-1 rounded-md px-2 py-1 text-left text-ui text-foreground',
                    ROW_INTERACTIVE,
                  )}
                >
                  <span className="min-w-0 truncate">{entry.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
