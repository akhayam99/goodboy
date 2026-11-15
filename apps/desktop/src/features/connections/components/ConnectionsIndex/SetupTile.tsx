import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ICON_SIZE, InteractiveRow } from '@goodboy/ui';

type Props = {
  readonly id: string;
  readonly glyph: ReactNode;
  readonly name: string;
  readonly verb: string;
  readonly line: string;
  readonly onOpen: () => void;
};

export const SetupTile = ({ id, glyph, name, verb, line, onOpen }: Props) => (
  <InteractiveRow
    label={`${name}, ${verb}`}
    isSelected={false}
    onOpen={onOpen}
    radius="lg"
    dataAttributes={{ 'data-connection-setup': id }}
    frameClassName="border border-border-soft"
    className="flex min-w-0 flex-col gap-1 px-4 py-2"
  >
    <span className="flex min-w-0 items-center gap-2">
      {glyph}
      <span className="min-w-0 flex-1 truncate text-row text-foreground">{name}</span>
      <span className="flex shrink-0 items-center gap-1 text-meta text-muted-foreground">
        {verb}
        <ChevronRight size={ICON_SIZE.row} aria-hidden />
      </span>
    </span>
    <span className="truncate text-meta text-muted-foreground">{line}</span>
  </InteractiveRow>
);
