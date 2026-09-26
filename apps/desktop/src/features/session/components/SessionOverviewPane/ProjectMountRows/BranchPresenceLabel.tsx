import { Cloud, CloudOff, GitMerge, House } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { WorktreeStatus } from '@goodboy/types';
import { branchPresenceOf, type BranchPresence } from '../../../../../shared/lib/branchPresence';

type Props = {
  readonly status: WorktreeStatus | null;
  readonly isMerged?: boolean;
};

type GlyphParams = {
  readonly kind: BranchPresence['kind'];
};

const presenceGlyphOf = ({ kind }: GlyphParams) => {
  switch (kind) {
    case 'local-only':
      return <House size={11} aria-hidden />;
    case 'gone-on-origin':
      return <CloudOff size={11} aria-hidden />;
    case 'on-origin':
      return <Cloud size={11} aria-hidden />;
    case 'merged':
      return <GitMerge size={11} aria-hidden />;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

export const BranchPresenceLabel = ({ status, isMerged = false }: Props) => {
  if (status === null) {
    return null;
  }
  const presence = branchPresenceOf({ status, isMerged });
  if (presence.kind === 'on-origin' && presence.toPush === null) {
    return null;
  }
  const label =
    presence.kind === 'on-origin' && presence.toPush !== null
      ? `${presence.toPush} to push`
      : presence.label;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 text-secondary',
        presence.kind === 'gone-on-origin' ? 'text-warning' : 'text-muted-foreground',
      )}
      title={presence.label}
    >
      {presenceGlyphOf({ kind: presence.kind })}
      {label}
    </span>
  );
};
