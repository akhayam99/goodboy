import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Markdown, FilledEmptyState } from '@goodboy/ui';
import type { ContextSlotHistoryEntry } from '@goodboy/types';
import { AuthorshipChip } from './AuthorshipChip';
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { CopyButton } from '@goodboy/ui';
import { useNow } from '../../../../../shared/hooks/useNow';

type HistoryEntryProps = {
  readonly entry: ContextSlotHistoryEntry;
  readonly renderAsMarkdown: boolean;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onRestore: (entry: ContextSlotHistoryEntry) => void;
};

const HistoryEntry = ({
  entry,
  renderAsMarkdown,
  expanded,
  onToggle,
  onRestore,
}: HistoryEntryProps) => {
  const now = useNow(30_000);
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-soft bg-elevated p-3">
      <div className="flex items-center gap-2">
        <AuthorshipChip byUser={entry.author === 'user'} />
        <span className="text-meta text-muted-foreground">
          {formatAge({ from: entry.createdAt, now })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <CopyButton
            presentation="icon"
            value={entry.value}
            label="copy this version"
            className="rounded-md p-0.5 text-faint-foreground hover:bg-hover hover:text-foreground"
          />
          <button
            type="button"
            onClick={() => onRestore(entry)}
            title="Restore this version"
            aria-label="Restore this version"
            className="flex items-center gap-1 rounded-sm px-2 py-0.5 text-chip text-muted-foreground hover:bg-hover hover:text-foreground"
          >
            <RotateCcw size={10} aria-hidden />
            restore
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="text-left"
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse entry' : 'Expand entry'}
      >
        {expanded ? (
          <div className="rounded-sm text-label text-foreground">
            {renderAsMarkdown ? (
              <Markdown text={entry.value} className="text-label" />
            ) : (
              <p className="whitespace-pre-wrap">{entry.value}</p>
            )}
          </div>
        ) : renderAsMarkdown ? (
          <div className="text-label text-foreground line-clamp-3">
            <Markdown text={entry.value} className="text-label" />
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-label text-foreground line-clamp-3">
            {entry.value}
          </p>
        )}
      </button>
    </li>
  );
};

type Props = {
  readonly renderAsMarkdown: boolean;
  readonly entries: ReadonlyArray<ContextSlotHistoryEntry>;
  readonly onRestore: (entry: ContextSlotHistoryEntry) => void;
};

export const SlotHistoryPanel = ({ renderAsMarkdown, entries, onRestore }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <FilledEmptyState
        icon={CONCEPT_ICONS.sessionSummary}
        tone={CONCEPT_TONE.sessionSummary}
        title="No history yet"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <HistoryEntry
          key={entry.id}
          entry={entry}
          renderAsMarkdown={renderAsMarkdown}
          expanded={expandedId === entry.id}
          onToggle={() => setExpandedId((prev) => (prev === entry.id ? null : entry.id))}
          onRestore={onRestore}
        />
      ))}
    </ul>
  );
};
