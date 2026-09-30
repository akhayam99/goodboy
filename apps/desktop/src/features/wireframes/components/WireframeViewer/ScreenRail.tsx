import type { ReactNode } from 'react';
import { Eyebrow, SelectableRow, WorkNode } from '@goodboy/ui';
import type { WireframePage } from '../../wireframePagePath';

type ScreenRailEntry = Readonly<{
  id: string;
  title: string;
  states: ReadonlyArray<Readonly<{ id: string; label: string }>>;
  badge?: ReactNode;
}>;

type Props = {
  readonly entries: ReadonlyArray<ScreenRailEntry>;
  readonly current: WireframePage | null;
  readonly onOpen: (page: WireframePage) => void;
};

export const ScreenRail = ({ entries, current, onOpen }: Props) => (
  <nav
    aria-label="Screens"
    data-testid="wireframe-screen-rail"
    className="flex min-w-0 flex-col gap-2"
  >
    <h3>
      <Eyebrow label="Screens" />
    </h3>
    <ol className="flex min-w-0 flex-col gap-0.5">
      {entries.map((entry, index) => {
        const isScreen = current?.screenId === entry.id;
        return (
          <li key={entry.id} className="flex min-w-0 flex-col gap-0.5">
            <SelectableRow
              selected={isScreen && current?.state === null}
              ariaCurrent={isScreen ? 'page' : undefined}
              onClick={() => onOpen({ screenId: entry.id, state: null })}
              className="items-center gap-2 px-1.5 py-1 text-body"
            >
              <WorkNode
                state={isScreen ? 'ready' : 'queued'}
                mark={{ kind: 'index', value: String(index + 1) }}
                label={`Screen ${index + 1}`}
              />
              <span className="min-w-0 flex-1 truncate">{entry.title}</span>
              {entry.badge ?? null}
            </SelectableRow>
            {isScreen && entry.states.length > 0 ? (
              <ul
                aria-label={`${entry.title} states`}
                className="flex min-w-0 flex-col gap-0.5 pl-7"
              >
                {entry.states.map((state) => (
                  <li key={state.id}>
                    <SelectableRow
                      selected={current?.state === (state.id === 'default' ? null : state.id)}
                      onClick={() =>
                        onOpen({
                          screenId: entry.id,
                          state: state.id === 'default' ? null : state.id,
                        })
                      }
                      className="px-1.5 py-0.5 text-secondary"
                    >
                      <span className="min-w-0 truncate">{state.label}</span>
                    </SelectableRow>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  </nav>
);
