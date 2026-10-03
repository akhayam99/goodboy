import type { ProviderHeadroom } from '@goodboy/core';
import { Chip, cn, type Tone } from '@goodboy/ui';
import type { RulesProviderRoom } from '../../rulesHeadroom';

const ROOM_CHIP: Readonly<Record<ProviderHeadroom, { label: string; tone: Tone }>> = {
  ok: { label: 'Room', tone: 'success' },
  tight: { label: 'Tight', tone: 'warning' },
  out: { label: 'At limit', tone: 'danger' },
  unknown: { label: 'No limit data', tone: 'neutral' },
};

const percentText = (fraction: number | null): string | null =>
  fraction === null ? null : `${Math.round(fraction * 100)}%`;

export const RulesProviderRoomRow = ({ room }: { readonly room: RulesProviderRoom }) => {
  const chip = ROOM_CHIP[room.headroom];
  const fiveHour = percentText(room.fiveHour);
  const weekly = percentText(room.weekly);
  return (
    <li className="flex min-h-10 items-center gap-3 px-2 py-1.5" data-testid="rules-provider-room">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-label text-foreground">{room.name}</span>
        <span className="text-secondary text-muted-foreground">
          {weekly === null ? room.stateLabel : `${room.stateLabel} · ${weekly} weekly`}
        </span>
      </span>
      {fiveHour === null ? null : (
        <span className="flex shrink-0 items-center gap-2 text-secondary tabular-nums text-muted-foreground">
          <span aria-hidden className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
            <span
              className={cn(
                'absolute inset-y-0 left-0 rounded-full',
                room.headroom === 'tight'
                  ? 'bg-warning'
                  : room.headroom === 'out'
                    ? 'bg-danger'
                    : 'bg-muted-foreground',
              )}
              style={{ width: fiveHour }}
            />
          </span>
          {`${fiveHour} · 5h`}
        </span>
      )}
      <Chip tone={chip.tone} size="xs" label={chip.label} />
    </li>
  );
};
