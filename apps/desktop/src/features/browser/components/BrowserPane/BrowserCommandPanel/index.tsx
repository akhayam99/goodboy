import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Eyebrow, ScrollFade } from '@goodboy/ui';
import { isSubmitChord } from '../../../../../shared/keyboard/isSubmitChord';
import { useAppStore } from '../../../../../store';
import type { BrowserVisit } from '../../../../../store/slices/browser-visits/types';
import { commandRowsOf } from '../../../commandRowsOf';
import type { CommandField } from '../../../hooks/useCommandField';
import { useBrowserPage } from '../../../hooks/useBrowserPage';
import { runCommandRow } from '../../../runCommandRow';
import type { BrowserPaneModel, CommandRow } from '../../../types';
import { BrowserCommandRow } from './BrowserCommandRow';

type Props = {
  readonly model: BrowserPaneModel;
  readonly field: CommandField;
};

type IndexParams = {
  readonly index: number;
};

type RunParams = {
  readonly row: CommandRow;
  readonly isAlternate: boolean;
};

const NO_VISITS: ReadonlyArray<BrowserVisit> = [];
const NO_MATCH = 'No tab or address matches';

export const BrowserCommandPanel = ({ model, field }: Props) => {
  const { sessionId } = model;
  const page = useBrowserPage({ sessionId });
  const visits = useAppStore((state) => state.browserVisits[sessionId] ?? NO_VISITS);
  const { titleOf } = model;
  const { groups, hasNoMatch } = useMemo(
    () => commandRowsOf({ text: field.query, groups: page.groups, visits, sessionId, titleOf }),
    [field.query, page.groups, visits, sessionId, titleOf],
  );
  const rows = useMemo(
    (): ReadonlyArray<CommandRow> => groups.flatMap((group) => group.rows),
    [groups],
  );
  const starts = useMemo(
    () =>
      groups.map((_, index) =>
        groups.slice(0, index).reduce((sum, group) => sum + group.rows.length, 0),
      ),
    [groups],
  );
  const { setActiveId } = field;
  const highlight = Math.min(field.highlight, Math.max(rows.length - 1, 0));
  const optionId = ({ index }: IndexParams): string => `${field.listId}-${index}`;
  const activeId = rows.length === 0 ? null : optionId({ index: highlight });

  useEffect(() => {
    void useAppStore.getState().loadBrowserVisits({ sessionId });
  }, [sessionId]);

  useEffect(() => {
    setActiveId({ id: activeId });
    if (activeId !== null) {
      document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [activeId, setActiveId]);

  const run = ({ row, isAlternate }: RunParams): void => {
    void runCommandRow({ row, isAlternate, model, onDone: field.close });
  };

  useLayoutEffect(() => {
    field.runRef.current = ({ isAlternate }) => {
      const row = rows[highlight];
      if (row === undefined) {
        return;
      }
      run({ row, isAlternate });
    };
    field.keysRef.current = (event) => {
      if (isSubmitChord(event)) {
        event.preventDefault();
        field.runRef.current?.({ isAlternate: true });
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }
      event.preventDefault();
      if (rows.length === 0) {
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      field.setHighlight({ index: (highlight + step + rows.length) % rows.length });
    };
    return () => {
      field.runRef.current = null;
      field.keysRef.current = null;
    };
  });

  if (!hasNoMatch && groups.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 px-2">
      <div className="overflow-hidden rounded-lg border border-border-soft bg-elevated shadow-sm">
        {hasNoMatch ? (
          <p role="status" className="px-3 py-2 text-meta text-muted-foreground">
            {NO_MATCH}
          </p>
        ) : (
          <ScrollFade className="max-h-80" fadeFrom="elevated" isPageScroller={false}>
            <ul
              id={field.listId}
              role="listbox"
              aria-label="Suggestions"
              className="flex flex-col gap-1 p-1"
            >
              {groups.map((group, groupIndex) => {
                const start = starts[groupIndex] ?? 0;
                return (
                  <li key={group.key} role="presentation" className="flex flex-col gap-1">
                    <Eyebrow label={group.label} className="px-2" />
                    <ul role="group" aria-label={group.label} className="flex flex-col">
                      {group.rows.map((row, index) => (
                        <BrowserCommandRow
                          key={row.key}
                          row={row}
                          id={optionId({ index: start + index })}
                          isSelected={start + index === highlight}
                          onHover={() => field.setHighlight({ index: start + index })}
                          onRun={() => run({ row, isAlternate: false })}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </ScrollFade>
        )}
      </div>
    </div>
  );
};
