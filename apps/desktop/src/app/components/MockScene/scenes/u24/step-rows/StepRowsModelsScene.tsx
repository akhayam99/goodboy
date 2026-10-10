import { Button, WORK_META_COLUMN } from '@goodboy/ui';
import { TimelineModelCell } from '../../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/TimelineModelCell';
import { TimelineRowMeta } from '../../../../../../features/session/components/SessionWorkspace/parts/TimelinePane/TimelineRowMeta';
import { STEP_ROWS_MODELS_ROWS } from './stepRowsModelsRows';

export const StepRowsModelsScene = () => (
  <div className="@container flex w-[760px] flex-col gap-1 p-4" data-testid="steprows-models">
    {STEP_ROWS_MODELS_ROWS.map((row) => (
      <div
        key={row.id}
        data-row-id={row.id}
        className="flex h-9 items-center gap-2 rounded-md px-2 text-body text-foreground"
      >
        <span className="min-w-0 flex-1 truncate">{row.title}</span>
        <TimelineRowMeta
          isPlanned={row.isPlanned}
          model={<TimelineModelCell summary={row.summary} isPlanned={row.isPlanned} />}
          time={row.time}
          cost={row.cost}
        />
        <span data-meta-column="action" className={WORK_META_COLUMN.action}>
          {row.action === null ? null : (
            <Button variant="secondary" size="xs">
              {row.action}
            </Button>
          )}
        </span>
      </div>
    ))}
  </div>
);
