import type { ReactNode } from 'react';
import { EmptyLine, Eyebrow, SectionHeader } from '@goodboy/ui';

type Props = {
  readonly id: 'providers' | 'tools' | 'calendar';
  readonly label: string;
  readonly place: string;
  readonly action?: ReactNode;
  readonly tiles: ReadonlyArray<ReactNode>;
  readonly setup: ReadonlyArray<ReactNode>;
  readonly empty: string | null;
};

const NOT_SET_UP = 'Not set up';

const TILE_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-4';

const SETUP_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3';

export const ConnectionsSection = ({ id, label, place, action, tiles, setup, empty }: Props) => (
  <section aria-label={label} data-connections-group={id} className="flex flex-col gap-3">
    <SectionHeader
      label={label}
      headingLevel={2}
      meta={<span className="text-meta text-faint-foreground">{place}</span>}
      action={action}
    />
    {tiles.length > 0 ? <div className={TILE_GRID}>{tiles}</div> : null}
    {tiles.length === 0 && empty !== null ? <EmptyLine>{empty}</EmptyLine> : null}
    {setup.length > 0 ? (
      <div role="group" aria-label={NOT_SET_UP} className="flex flex-col gap-2">
        <Eyebrow label={NOT_SET_UP} />
        <div className={SETUP_GRID}>{setup}</div>
      </div>
    ) : null}
  </section>
);
