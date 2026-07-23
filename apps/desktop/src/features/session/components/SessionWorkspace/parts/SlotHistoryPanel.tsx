import { useEffect, useRef, useState } from 'react';
import { Check, Copy, RotateCcw, X } from 'lucide-react';
import { Divider, Markdown, ScrollFade, cn } from '@goodboy/ui';
import type { ContextSlotHistoryEntry } from '@goodboy/types';

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
  const [entryCopied, setEntryCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const copyEntry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(entry.value);
    } catch {
      return;
    }
    setEntryCopied(true);
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }
    copyTimer.current = window.setTimeout(() => setEntryCopied(false), 1500);
  };

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-subtle p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-2xs uppercase tracking-wide',
            entry.author === 'user' ? 'bg-accent/10 text-accent' : 'bg-info/10 text-info',
          )}
        >
          {entry.author === 'user' ? 'you' : 'agent'}
        </span>
        <span className="text-2xs text-muted-foreground">{formatRelative(entry.createdAt)}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => void copyEntry(e)}
            title={entryCopied ? 'copied' : 'copy this version'}
            aria-label="copy this version"
            className="rounded-sm p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          >
            {entryCopied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => onRestore(entry)}
            title="restore this version"
            aria-label="restore"
            className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
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
        aria-label={expanded ? 'collapse entry' : 'expand entry'}
      >
        {expanded ? (
          <div className="rounded text-xs leading-relaxed text-foreground">
            {renderAsMarkdown ? (
              <Markdown text={entry.value} className="text-xs" />
            ) : (
              <p className="whitespace-pre-wrap">{entry.value}</p>
            )}
          </div>
        ) : renderAsMarkdown ? (
          <div className="text-xs leading-relaxed text-foreground line-clamp-3">
            <Markdown text={entry.value} className="text-xs" />
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground line-clamp-3">
            {entry.value}
          </p>
        )}
      </button>
    </li>
  );
};

type Props = {
  readonly label: string;
  readonly renderAsMarkdown: boolean;
  readonly entries: ReadonlyArray<ContextSlotHistoryEntry>;
  readonly onRestore: (entry: ContextSlotHistoryEntry) => void;
  readonly onClose: () => void;
};

export const SlotHistoryPanel = ({
  label,
  renderAsMarkdown,
  entries,
  onRestore,
  onClose,
}: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-xs font-medium text-foreground">history: {label}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close history panel"
          className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <Divider />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3">
        {entries.length === 0 ? (
          <p className="text-xs italic text-muted-foreground">no history yet</p>
        ) : (
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
        )}
      </ScrollFade>
    </div>
  );
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ago`;
  }
  return `${Math.floor(hrs / 24)}d ago`;
};
