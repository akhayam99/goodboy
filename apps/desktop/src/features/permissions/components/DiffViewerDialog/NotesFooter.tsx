import { Loader2, Sparkles } from 'lucide-react';

type Props = {
  openCount: number;
  spawning: boolean;
  onPropose: () => void;
};

export const NotesFooter = ({ openCount, spawning, onPropose }: Props) => {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border-soft bg-muted/20 px-4 py-2.5">
      <span className="text-xs text-muted-foreground">
        {openCount} open {openCount === 1 ? 'note' : 'notes'} · spawn a reviewer to propose fixes
      </span>
      <button
        type="button"
        onClick={onPropose}
        disabled={spawning}
        className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
        title="spawn a reviewer agent that proposes fixes without touching code"
      >
        {spawning ? (
          <Loader2 size={11} className="animate-spin" aria-hidden />
        ) : (
          <Sparkles size={11} aria-hidden />
        )}
        Propose fixes
      </button>
    </div>
  );
};
