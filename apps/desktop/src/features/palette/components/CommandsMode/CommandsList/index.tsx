import type { Ref } from 'react';
import { EmptyState, Eyebrow, ScrollFade, SkeletonRow, SkeletonSwap } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import type { CommandSection } from '../../../commandList';
import type { PaletteEntry } from '../../../types';
import { CommandRowView } from '../CommandRowView';
import { PALETTE_LIST_PAD_PX, PALETTE_SECTION_PX } from '../paletteBodyLayout';

const PALETTE_SKELETON_ROWS = [0, 1, 2];

type RowParams = { readonly id: string };

type Props = {
  readonly listRef: Ref<HTMLUListElement>;
  readonly listboxId: string;
  readonly maxHeight: number;
  readonly sections: ReadonlyArray<CommandSection>;
  readonly selectedKey: string | null;
  readonly query: string;
  readonly isLoaded: boolean;
  readonly gateKey: string;
  readonly optionId: (params: RowParams) => string;
  readonly onSelect: (params: RowParams) => void;
  readonly onRun: (entry: PaletteEntry) => void;
};

export const CommandsList = ({
  listRef,
  listboxId,
  maxHeight,
  sections,
  selectedKey,
  query,
  isLoaded,
  gateKey,
  optionId,
  onSelect,
  onRun,
}: Props) => (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ maxHeight }}>
    <ScrollFade className="min-h-0 min-w-0 flex-1" fadeFrom="floating">
      <ul
        ref={listRef}
        id={listboxId}
        role="listbox"
        aria-label="Commands"
        aria-busy={!isLoaded}
        className="flex flex-col"
        style={{ padding: PALETTE_LIST_PAD_PX }}
      >
        {sections.length === 0 ? (
          <li
            role={isLoaded ? 'presentation' : 'option'}
            aria-selected={isLoaded ? undefined : false}
            aria-disabled={isLoaded ? undefined : true}
          >
            <SkeletonSwap
              gateKey={gateKey}
              isLoaded={isLoaded}
              skeleton={PALETTE_SKELETON_ROWS.map((row) => (
                <SkeletonRow key={row} label="Loading commands" />
              ))}
            >
              <EmptyState
                size="section"
                icon={CONCEPT_ICONS.search}
                tone={CONCEPT_TONE.search}
                title={
                  query.trim() === ''
                    ? 'Nothing to do here yet'
                    : `Nothing matches “${query.trim()}”`
                }
                className="justify-center"
              />
            </SkeletonSwap>
          </li>
        ) : (
          sections.flatMap((section, sectionIndex) => [
            ...(section.title === null
              ? []
              : [
                  <li
                    key={`section:${section.title}`}
                    role="presentation"
                    className="flex shrink-0 items-end px-2"
                    style={{ height: PALETTE_SECTION_PX }}
                  >
                    <Eyebrow label={section.title} />
                  </li>,
                ]),
            ...section.rows.map((row) => (
              <CommandRowView
                key={`${sectionIndex}:${row.item.key}`}
                row={row}
                id={optionId({ id: row.item.key })}
                isSelected={row.item.key === selectedKey}
                onHover={() => onSelect({ id: row.item.key })}
                onRun={() => onRun(row.item)}
              />
            )),
          ])
        )}
      </ul>
    </ScrollFade>
  </div>
);
