import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Popover } from '@goodboy/ui';
import { Inbox, Loader2, Sparkles } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface BrainDumpPopoverProps {
  readonly open: boolean;
  readonly anchorRef: React.RefObject<HTMLElement | null>;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
  readonly onOpenBacklog: () => void;
}

interface AnchorRect {
  top: number;
  left: number;
}

const POPOVER_WIDTH = 360;
const POPOVER_OFFSET = 8;

function computePosition(anchor: HTMLElement | null): AnchorRect | null {
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - POPOVER_WIDTH - 8, rect.left));
  const top = rect.top - POPOVER_OFFSET; // anchor sits above the popover; we position below
  // We render the popover *above* the icon so place its bottom edge near rect.top
  const realTop = Math.max(8, rect.top - 280);
  return { top: realTop, left };
}

/**
 * Lightweight capture surface anchored to the pencil icon in the sidebar
 * footer. Submits push raw text into the brain-dump pipeline asynchronously,
 * so the popover stays open and the textarea clears for the next dump.
 */
export function BrainDumpPopover({
  open,
  anchorRef,
  workspaceId,
  onClose,
  onOpenBacklog,
}: BrainDumpPopoverProps) {
  const submitBrainDump = useAppStore((s) => s.submitBrainDump);
  const ideasCount = useAppStore((s) => (s.ideas[workspaceId] ?? []).length);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft('');
      setConfirmation(null);
      return;
    }
    setAnchorRect(computePosition(anchorRef.current));
    // Focus on next tick so the popover's mount finishes first.
    const id = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    return () => {
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    };
  }, []);

  const onSubmit = async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || busy) return;
    setBusy(true);
    try {
      await submitBrainDump(workspaceId, trimmed);
      setDraft('');
      setConfirmation('captured — rephrasing…');
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmation(null), 1200);
      textareaRef.current?.focus();
    } catch (err) {
      setConfirmation(err instanceof Error ? err.message : 'capture failed');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void onSubmit();
    }
  };

  if (!open || !anchorRect) return null;

  return createPortal(
    <Popover
      innerRef={wrapperRef}
      role="dialog"
      ariaLabel="brain dump"
      className="fixed z-50 flex flex-col gap-2 border-border bg-background p-3 text-foreground shadow-xl"
      style={{ top: anchorRect.top, left: anchorRect.left, width: POPOVER_WIDTH }}
    >
      <header className="flex items-center gap-2 text-xs">
        <Sparkles size={12} aria-hidden className="text-primary" />
        <span className="font-medium text-foreground">brain dump</span>
        <span className="text-muted-foreground/80">capture without losing flow</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenBacklog();
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground"
          title="open the backlog view"
          aria-label="open backlog"
        >
          <Inbox size={11} aria-hidden />
          backlog ({ideasCount})
        </button>
      </header>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="drop an idea… ⌘↵ to capture, ↵ for newline"
        rows={4}
        disabled={busy}
        aria-label="brain dump text"
        className="w-full resize-none rounded-md border border-border/40 bg-background px-2 py-1.5 text-xs leading-5 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary/40 focus-visible:ring-1 focus-visible:ring-primary/15 disabled:opacity-50"
      />
      <footer className="flex items-center justify-between text-2xs text-muted-foreground">
        <span aria-live="polite">
          {confirmation ? <span className="text-success">{confirmation}</span> : ' '}
        </span>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={busy || draft.trim().length === 0}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-2xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={10} aria-hidden className="animate-spin" /> : null}
          capture
        </button>
      </footer>
    </Popover>,
    document.body,
  );
}
