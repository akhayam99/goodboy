import type { ReactNode } from 'react';
import { cn, Divider } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  openCount: number;
  spawning: boolean;
  routing: ReactNode;
  onPropose: () => void;
};

export const NotesFooter = ({ openCount, spawning, routing, onPropose }: Props) => {
  return (
    <>
      <Divider className="shrink-0" />
      <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/20 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {openCount} open {openCount === 1 ? 'note' : 'notes'} · spawn a reviewer to propose fixes
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-60">{routing}</div>
          <button
            type="button"
            onClick={onPropose}
            disabled={spawning}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50',
              spawning && 'animate-border-pulse',
            )}
            title="Spawn a reviewer agent that proposes fixes without touching code"
          >
            <CONCEPT_ICONS.agents size={11} aria-hidden />
            Propose fixes
          </button>
        </div>
      </div>
    </>
  );
};
