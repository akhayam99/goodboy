import type { ReactNode } from 'react';
import { InteractiveRow, cn, tintClasses } from '@goodboy/ui';
import type { ConnectionState } from '../../model/connectionState';
import { StateWord } from './StateWord';

type Props = {
  readonly id: string;
  readonly glyph: ReactNode;
  readonly name: string;
  readonly state: ConnectionState;
  readonly onOpen: () => void;
  readonly children: ReactNode;
};

export const ConnectionTile = ({ id, glyph, name, state, onOpen, children }: Props) => (
  <InteractiveRow
    label={`${name}, ${state.word}`}
    isSelected={false}
    onOpen={onOpen}
    radius="lg"
    dataAttributes={{ 'data-connection-tile': id }}
    frameClassName={cn(
      'border bg-subtle',
      state.tone === null ? 'border-border-soft' : tintClasses(state.tone).border,
    )}
    className="flex min-w-0 flex-col gap-3 p-4"
  >
    <span className="flex min-w-0 items-center gap-2">
      {glyph}
      <span className="min-w-0 flex-1 truncate text-row text-foreground">{name}</span>
      <StateWord state={state} />
    </span>
    <span className="flex min-w-0 flex-col gap-2">{children}</span>
  </InteractiveRow>
);
