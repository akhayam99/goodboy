import { useEffect, useState } from 'react';
import { ScrollArea, Textarea, cn } from '@kay-am/ui';
import { SLOT_KEYS, SLOT_LABELS, type SlotKey } from '@kay-am/core';
import type { ContextSlot, Session } from '@kay-am/types';
import { useAppStore, useSessionSlots } from '../store';

interface ContextPanelProps {
  session: Session;
}

type SummarizerStatus = 'idle' | 'running' | 'error';

export function ContextPanel({ session }: ContextPanelProps) {
  const slots = useSessionSlots(session.id);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const toggleSessionSlot = useAppStore((s) => s.toggleSessionSlot);

  // summarizer not yet implemented (#8) — placeholder until wired
  const summarizerStatus: SummarizerStatus = 'idle';
  const summarizerLastUpdate: string | null = null;

  const slotsByKey = new Map<string, ContextSlot>(slots.map((s) => [s.key, s]));

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3">
        <header className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            context
          </span>
          <SummarizerBadge status={summarizerStatus} lastUpdate={summarizerLastUpdate} />
        </header>

        <ul className="flex flex-col gap-3">
          {SLOT_KEYS.map((key) => {
            const slot = slotsByKey.get(key);
            return (
              <SlotRow
                key={key}
                slotKey={key}
                slot={slot}
                onCommit={(value) => void upsertSessionSlot(session.id, key, value)}
                onToggle={(enabled) => void toggleSessionSlot(session.id, key, enabled)}
              />
            );
          })}
        </ul>
      </div>
    </ScrollArea>
  );
}

interface SlotRowProps {
  slotKey: SlotKey;
  slot: ContextSlot | undefined;
  onCommit: (value: string) => void;
  onToggle: (enabled: boolean) => void;
}

function SlotRow({ slotKey, slot, onCommit, onToggle }: SlotRowProps) {
  const enabled = slot?.enabled ?? true;
  const value = slot?.value ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{SLOT_LABELS[slotKey]}</label>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={cn(
            'rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
            enabled
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground',
          )}
          aria-pressed={enabled}
        >
          {enabled ? 'on' : 'off'}
        </button>
      </div>

      {editing ? (
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(value);
              setEditing(false);
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
          className="min-h-12 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'whitespace-pre-wrap rounded-md border border-transparent px-2 py-1.5 text-left text-xs hover:border-border hover:bg-muted/40',
            !enabled && 'opacity-60',
          )}
        >
          {value.length > 0 ? (
            value
          ) : (
            <span className="italic text-muted-foreground">empty — click to edit</span>
          )}
        </button>
      )}
    </li>
  );
}

function SummarizerBadge({
  status,
  lastUpdate,
}: {
  status: SummarizerStatus;
  lastUpdate: string | null;
}) {
  const styles: Record<SummarizerStatus, string> = {
    idle: 'bg-muted text-muted-foreground',
    running: 'bg-primary/10 text-primary',
    error: 'bg-danger/10 text-danger',
  };
  const label = status === 'idle' ? 'summarizer idle' : status;
  const tooltip = lastUpdate ? `last update: ${lastUpdate}` : 'summarizer not yet wired';
  return (
    <span
      title={tooltip}
      className={cn('rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide', styles[status])}
    >
      {label}
    </span>
  );
}
