import type { ReactNode } from 'react';
import { AlertCircle, ArrowUp, Check, GitCommitHorizontal } from 'lucide-react';
import { cn, Eyebrow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { LINE_FILL, SIGN_TEXT } from '../../../diff/lib/lineTone';
import { useOriginCommitDiff } from '../../hooks/useOriginCommitDiff';
import { inlineChangePlan } from '../../inlineChangePlan';
import { REMOTE_LABEL } from '../../reviewRemote';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

const SIGN = { add: '+', del: '-', context: ' ' } as const;
const MINI_DIFF_LINES = 6;

const timeOf = ({ ms }: { readonly ms: number }): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Sha = ({ sha }: { readonly sha: string }) => (
  <code className="rounded-sm bg-hover px-1 font-mono text-code text-foreground">
    {sha.slice(0, 7)}
  </code>
);

type FactProps = { readonly icon: ReactNode; readonly children: ReactNode; readonly tone?: string };

const Fact = ({ icon, children, tone = 'text-muted-foreground' }: FactProps) => (
  <p className="flex min-w-0 items-start gap-2 text-secondary text-foreground">
    <span aria-hidden className={cn('mt-0.5 shrink-0', tone)}>
      {icon}
    </span>
    <span className="min-w-0">{children}</span>
  </p>
);

const MiniDiff = ({ sessionId, entry }: Props) => {
  const fix = entry.facts?.elsewhere ?? null;
  const files = useOriginCommitDiff({
    sessionId,
    sha: fix?.origin === 'commit' ? fix.sha : null,
    path: fix?.path ?? null,
    fallbackWorktreePath: entry.row.attempt?.mountTarget?.worktreePath ?? null,
  });
  const lines = inlineChangePlan({ files }).files[0]?.hunks[0]?.lines.slice(0, MINI_DIFF_LINES);
  if (lines === undefined || lines.length === 0) {
    return null;
  }
  return (
    <div className="min-w-0 overflow-hidden rounded-md bg-background py-1.5 font-mono text-code">
      {lines.map((line, index) => (
        <p key={index} className={cn('flex min-w-0 gap-3 px-3', LINE_FILL[line.kind])}>
          <span aria-hidden className={cn('w-2 shrink-0', SIGN_TEXT[line.kind])}>
            {SIGN[line.kind]}
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">
            {line.text}
          </span>
        </p>
      ))}
    </div>
  );
};

const facts = ({ entry }: { readonly entry: ReviewEntry }): ReactNode => {
  const git = entry.facts;
  if (git === null || entry.remote === null) {
    return null;
  }
  const icon = <GitCommitHorizontal size={ICON_SIZE.control} />;
  if (entry.remote === 'you_replied') {
    const at = git.userReply?.createdAtMs ?? null;
    return (
      <>
        <Fact icon={<Check size={ICON_SIZE.control} />}>
          You already replied in this thread{at === null ? '' : ` at ${timeOf({ ms: at })}`}.
        </Fact>
        <Fact icon={<ArrowUp size={ICON_SIZE.control} />}>{REMOTE_LABEL.nothingToPost}</Fact>
      </>
    );
  }
  if (entry.remote === 'on_origin' && git.onOrigin !== null) {
    return (
      <>
        <Fact icon={icon}>
          <Sha sha={git.onOrigin.sha} /> is on{' '}
          <code className="rounded-sm bg-hover px-1 font-mono text-code text-foreground">
            origin/{git.onOrigin.branch}
          </code>
          .
        </Fact>
        <Fact icon={<ArrowUp size={ICON_SIZE.control} />}>Pushed from outside Goodboy.</Fact>
      </>
    );
  }
  if (entry.remote === 'looks_fixed' && git.elsewhere !== null) {
    const fix = git.elsewhere;
    const place =
      fix.path === null ? null : `${fix.path}${fix.line === null ? '' : `:${fix.line}`}`;
    if (fix.origin === 'cherry') {
      return (
        <Fact icon={icon}>
          <Sha sha={fix.sha} /> on origin carries the same change as the fix that was drafted.
        </Fact>
      );
    }
    return (
      <Fact icon={icon}>
        {fix.author ?? 'Someone'} pushed <Sha sha={fix.sha} />
        {fix.committedAt === null ? '' : ` at ${timeOf({ ms: fix.committedAt })}`}, after the
        comment.{place === null ? '' : ` It changes ${place}.`}
      </Fact>
    );
  }
  if (entry.remote === 'missing' && git.missing !== null) {
    return (
      <Fact icon={<AlertCircle size={ICON_SIZE.control} />} tone="text-warning">
        <Sha sha={git.missing.sha} /> is no longer on the branch or on origin.
      </Fact>
    );
  }
  return null;
};

export const ThreadGitEvidence = ({ sessionId, entry }: Props) => (
  <section
    aria-label={REMOTE_LABEL.evidence}
    className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-3"
  >
    <Eyebrow label={REMOTE_LABEL.evidence} />
    {facts({ entry })}
    {entry.remote === 'looks_fixed' && <MiniDiff sessionId={sessionId} entry={entry} />}
  </section>
);
