import { cn } from '../../cn';
import type { WeekGridDay } from './types';
import { WeekGridBlockItem } from './WeekGridBlockItem';

type Props = {
  readonly days: ReadonlyArray<WeekGridDay>;
  readonly fromMinute: number;
  readonly toMinute: number;
  readonly ariaLabel: string;
  readonly selectedKey?: string | null;
  readonly onSelect?: (key: string) => void;
};

export const WeekGrid = ({
  days,
  fromMinute,
  toMinute,
  ariaLabel,
  selectedKey = null,
  onSelect,
}: Props) => {
  const spanMinutes = Math.max(toMinute - fromMinute, 1);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-week-grid=""
      className="grid min-w-0 gap-2"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((day) => (
        <section
          key={day.key}
          aria-label={day.label}
          data-week-day={day.key}
          data-today={day.isToday ? '' : undefined}
          className="flex min-w-0 flex-col gap-2"
        >
          <h3 className={cn('text-eyebrow', day.isToday ? 'text-info' : 'text-muted-foreground')}>
            {day.label}
          </h3>
          <ul className="relative h-80 rounded-lg bg-subtle">
            {day.blocks.map((block) => (
              <WeekGridBlockItem
                key={block.key}
                block={block}
                fromMinute={fromMinute}
                spanMinutes={spanMinutes}
                isSelected={selectedKey === block.key}
                onSelect={onSelect ?? null}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
