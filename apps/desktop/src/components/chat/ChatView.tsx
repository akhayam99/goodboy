import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@kay-am/types';
import { useAppStore, useTranscript } from '../../store';
import { EndSessionButton } from '../EndSessionButton';
import { OpenInEditorButton } from '../OpenInEditorButton';
import { ChatInput } from './ChatInput';
import { reduceTranscript } from './transcript-items';
import { TranscriptCard } from './TranscriptCards';

interface ChatViewProps {
  session: Session;
}

const PIN_TOLERANCE_PX = 32;

export function ChatView({ session }: ChatViewProps) {
  const events = useTranscript(session.id);
  const items = useMemo(() => reduceTranscript(events), [events]);
  const worktreePath = useAppStore((s) => s.sessionWorktrees[session.id] ?? null);
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

  const isEnded = session.state.kind === 'ended';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border px-3 py-2">
        <div>
          <h1 className="text-sm font-semibold tracking-tight">{session.goal}</h1>
          <p className="text-xs text-muted-foreground">state: {session.state.kind}</p>
        </div>
        <div className="flex items-center gap-1">
          <OpenInEditorButton worktreePath={worktreePath} />
          <EndSessionButton session={session} />
        </div>
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
      {isEnded ? (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          session ended — no further turns. branch preserved.
        </div>
      ) : (
        <ChatInput session={session} />
      )}
    </div>
  );
}
