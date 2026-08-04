import { useState } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import type { SpawnedChild } from '../../../../shared/utils/spawnedChildren';
import { TranscriptDisclosure } from '../TranscriptDisclosure';
import { TranscriptRowHeader } from '../TranscriptRowHeader';

type Props = {
  readonly spawned: ReadonlyArray<SpawnedChild>;
  readonly onAdvance?: ((childAgentId: AgentId) => void) | undefined;
};

const accent = tintClasses('merged');

export const SpawnedChildrenCard = ({ spawned, onAdvance }: Props) => {
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const total = spawned.length;
  const unfinished = spawned.find((child) => child.status !== 'completed');
  const canAdvance = onAdvance != null && unfinished != null;

  return (
    <TranscriptDisclosure
      tone="merged"
      open={open}
      bodyClassName="gap-2"
      data-testid="spawned-children-card"
      header={
        <TranscriptRowHeader
          grouped
          tone="merged"
          icon={<Layers size={12} aria-hidden />}
          eyebrow="fanned out"
          preview={spawned.map((child) => child.agent.name).join(', ')}
          meta={`${total}`}
          open={open}
          onToggle={() => setOpen((value) => !value)}
          aria-label={open ? 'Collapse spawned agents' : 'Expand spawned agents'}
        />
      }
    >
      <ul className="flex min-w-0 flex-col gap-1.5">
        {spawned.map((child) => (
          <li key={child.agent.id} className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-foreground/90">
              {child.agent.name}
            </span>
            {child.assignment != null ? (
              <span className="truncate text-2xs text-muted-foreground">{child.assignment}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {canAdvance ? (
        <button
          type="button"
          data-testid="spawned-children-advance"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            onAdvance(unfinished.agent.id);
          }}
          onBlur={() => setConfirming(false)}
          className={cn(
            'flex items-center gap-1 self-start rounded-md border px-2 py-1 text-2xs font-medium transition-colors',
            confirming
              ? cn(accent.border, accent.bg, accent.text)
              : cn('border-border text-muted-foreground', accent.hoverBorder, accent.hoverBgSoft),
          )}
        >
          {confirming ? 'advance without marker?' : 'advance to next cluster'}
          <ChevronRight size={12} aria-hidden />
        </button>
      ) : null}
    </TranscriptDisclosure>
  );
};
