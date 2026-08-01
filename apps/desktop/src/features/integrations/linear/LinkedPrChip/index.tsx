import { cn } from '@goodboy/ui';
import { GitPullRequest } from 'lucide-react';
import type { LinearLinkedPr } from '../client';
import { prStatusTone } from '../prStatusTone';

type Props = {
  readonly pr: LinearLinkedPr;
};

export const LinkedPrChip = ({ pr }: Props) => {
  return (
    <a
      href={pr.url}
      target="_blank"
      rel="noreferrer"
      title={pr.url}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium motion-safe:transition-opacity hover:opacity-80',
        prStatusTone({ status: pr.status }),
      )}
    >
      <GitPullRequest size={11} aria-hidden />#{pr.number}
      {pr.status != null ? <span className="opacity-70">· {pr.status}</span> : null}
    </a>
  );
};
