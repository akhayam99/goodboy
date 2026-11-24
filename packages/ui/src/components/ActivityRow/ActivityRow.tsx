import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { ToneBar } from '../ToneBar';
import {
  ACTIVITY_ROW_BAR_TONE,
  ACTIVITY_ROW_DENSITY,
  ACTIVITY_ROW_ORDINAL,
  ACTIVITY_ROW_TEXT_SIZE,
  ACTIVITY_ROW_TEXT_TONE,
  type ActivityRowDensity,
  type ActivityRowOrdinalSlot,
  type ActivityRowTextSize,
  type ActivityRowTone,
} from './activityRowSpec';

type Props = {
  readonly text: ReactNode;
  readonly tone: ActivityRowTone;
  readonly density: ActivityRowDensity;
  readonly marker?: ReactNode;
  readonly ordinal?: ReactNode;
  readonly ordinalSlot?: ActivityRowOrdinalSlot;
  readonly glyph?: ReactNode;
  readonly textSize?: ActivityRowTextSize;
  readonly meta?: ReactNode;
  readonly className?: string;
};

export const ActivityRow = ({
  text,
  tone,
  density,
  marker = null,
  ordinal = null,
  ordinalSlot = 'narrow',
  glyph = null,
  textSize = 'ui',
  meta = null,
  className,
}: Props) => {
  const layout = ACTIVITY_ROW_DENSITY[density];
  const barTone = ACTIVITY_ROW_BAR_TONE[tone];
  return (
    <div
      data-testid="activity-row"
      data-activity-tone={tone}
      data-activity-density={density}
      className={cn('relative flex min-w-0 flex-1 gap-2 pl-3 pr-2', layout.row, className)}
    >
      {barTone === null ? null : <ToneBar tone={barTone} density="row" />}
      {marker === null ? null : <span className={layout.slot}>{marker}</span>}
      {ordinal === null ? null : (
        <span
          className={cn(
            layout.slot,
            ACTIVITY_ROW_ORDINAL[ordinalSlot],
            'tabular-nums text-faint-foreground',
          )}
        >
          {ordinal}
        </span>
      )}
      {glyph === null ? null : <span className={layout.slot}>{glyph}</span>}
      <span
        data-testid="activity-row-text"
        className={cn(
          'min-w-0 flex-1',
          ACTIVITY_ROW_TEXT_SIZE[textSize],
          ACTIVITY_ROW_TEXT_TONE[tone],
          layout.text,
        )}
      >
        {text}
      </span>
      {meta}
    </div>
  );
};
