import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@kay-am/types';
import { useTranscript } from '../../store';
import { reduceTranscript } from './transcript-items';
import { TranscriptCard } from './TranscriptCards';

interface ChatViewProps {
  session: Session;
}

const PIN_TOLERANCE_PX = 32;

export function ChatView({ session }: ChatViewProps) {
  const events = useTranscript(session.id);
  const items = useMemo(() => reduceTranscript(events), [events]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [items, pinned]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < PIN_TOLERANCE_PX);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <h1 className="text-sm font-semibold tracking-tight">{session.goal}</h1>
        <p className="text-xs text-muted-foreground">state: {session.state.kind}</p>
      </div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="relative flex-1 overflow-y-auto px-4 py-3"
      >
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">no turns yet — send a message.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.key}>
                <TranscriptCard item={item} />
              </li>
            ))}
          </ul>
        )}
        {!pinned ? (
          <button
            type="button"
            className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1 text-xs shadow"
            onClick={() => {
              setPinned(true);
              const el = scrollerRef.current;
              if (el) el.scrollTop = el.scrollHeight;
            }}
          >
            jump to latest
          </button>
        ) : null}
      </div>
    </div>
  );
}
