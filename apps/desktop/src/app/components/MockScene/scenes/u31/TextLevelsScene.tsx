import { Chip, ListGrid, ListGridGroup, ListGridRow, PaneTitleRow, formatUsd } from '@goodboy/ui';
import { RelativeTime } from '../../../../../shared/components/RelativeTime';
import { countSlotText } from '../../../../../shared/utils/countSlotText';
import {
  LEVELS_COLUMNS,
  LEVELS_GROUP,
  LEVELS_HYPHEN,
  LEVELS_META,
  LEVELS_PROSE,
  LEVELS_RUNS,
  LEVELS_TITLE,
} from './textLevelsSeed';

const FRAME_WIDTH = 680;

export const TextLevelsScene = () => (
  <div data-shot style={{ width: FRAME_WIDTH }} className="bg-background text-foreground">
    <div className="flex flex-col gap-6 p-6">
      <PaneTitleRow title={LEVELS_TITLE} meta={LEVELS_META} />
      <p className="text-prose text-foreground">{LEVELS_PROSE}</p>
      <ListGrid label="Runs" columns={LEVELS_COLUMNS} isGrouped>
        <ListGridGroup label={LEVELS_GROUP} count={LEVELS_RUNS.length} headingLevel={2}>
          {LEVELS_RUNS.map((run) => (
            <ListGridRow
              key={run.id}
              rowHeight="stack"
              cells={[
                <span key="title" className="flex min-w-0 flex-col">
                  <span className="truncate text-row text-foreground">{run.title}</span>
                  <span className="truncate text-meta text-muted-foreground">{run.second}</span>
                </span>,
                <Chip key="state" tone={run.tone} label={run.state} />,
                countSlotText({ count: run.scouts }),
                formatUsd(run.costUsd),
                <RelativeTime key="age" iso={run.startedAt} />,
              ]}
            />
          ))}
        </ListGridGroup>
      </ListGrid>
      <p className="text-meta text-muted-foreground">{LEVELS_HYPHEN}</p>
    </div>
  </div>
);
