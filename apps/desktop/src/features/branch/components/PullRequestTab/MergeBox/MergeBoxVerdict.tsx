import {
  CircleCheck,
  CircleDashed,
  CircleX,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Hourglass,
  ListOrdered,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { ICON_SIZE, cn, tintClasses } from '@goodboy/ui';
import type { MergeBoxVerdict as Verdict, MergeBoxVerdictKind } from './mergeBox';

type Props = {
  readonly verdict: Verdict;
};

const GLYPH: Readonly<Record<MergeBoxVerdictKind, LucideIcon>> = {
  blocked: CircleX,
  waiting: Hourglass,
  checking: CircleDashed,
  ready: CircleCheck,
  draft: GitPullRequestDraft,
  queued: ListOrdered,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};

const glyphOf = ({ verdict }: Props): LucideIcon =>
  verdict.kind === 'blocked' && verdict.tone === 'warning' ? TriangleAlert : GLYPH[verdict.kind];

export const MergeBoxVerdict = ({ verdict }: Props) => {
  const Glyph = glyphOf({ verdict });
  return (
    <div
      data-verdict={verdict.kind}
      data-tone={verdict.tone}
      className="flex min-w-0 items-center gap-3 px-3 py-2"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill">
        <Glyph
          size={ICON_SIZE.notice}
          aria-hidden
          className={cn('shrink-0', tintClasses(verdict.tone).icon)}
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-heading text-foreground">{verdict.word}</span>
        {verdict.line === null ? null : (
          <span className="min-w-0 text-meta text-muted-foreground">{verdict.line}</span>
        )}
      </span>
    </div>
  );
};
