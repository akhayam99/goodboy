import { memo } from 'react';
import type { SearchHit } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { SEARCH_KIND_META } from '../../searchKindMeta';
import { hitCrumb, hitHeadline } from '../../hitLabels';
import { MarkedText } from './MarkedText';

type Props = {
  readonly hit: SearchHit;
  readonly optionId: string;
  readonly isSelected: boolean;
  readonly isBlocked: boolean;
  readonly onHover: (docId: string) => void;
  readonly onOpen: (docId: string) => void;
};

export const SearchResultRow = memo(
  ({ hit, optionId, isSelected, isBlocked, onHover, onOpen }: Props) => {
    const meta = SEARCH_KIND_META[hit.kind];
    const Icon = meta.icon;
    const crumb = hitCrumb({ hit });
    return (
      <li
        id={optionId}
        role="option"
        aria-selected={isSelected}
        aria-disabled={isBlocked}
        data-selected={isSelected ? 'true' : undefined}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-sm px-3 py-2',
          isSelected ? 'bg-selected' : 'hover:bg-hover',
        )}
        onMouseEnter={() => onHover(hit.docId)}
        onMouseDown={(event) => {
          event.preventDefault();
          onOpen(hit.docId);
        }}
      >
        <Icon
          size={14}
          aria-hidden
          className={cn('mt-0.5 shrink-0', tintClasses(meta.tone).text)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'truncate text-row',
              isBlocked ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            <MarkedText segments={hitHeadline({ hit })} />
          </span>
          {hit.snippet.length > 0 ? (
            <span className="line-clamp-2 text-label text-muted-foreground">
              <MarkedText segments={hit.snippet} />
            </span>
          ) : null}
          {crumb.length > 0 ? (
            <span className="truncate text-secondary text-faint-foreground">{crumb}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-secondary text-faint-foreground">{meta.label}</span>
          <span className="text-meta text-faint-foreground">
            {formatRelativeAge({ fromIso: hit.occurredAt })}
          </span>
        </div>
      </li>
    );
  },
);
