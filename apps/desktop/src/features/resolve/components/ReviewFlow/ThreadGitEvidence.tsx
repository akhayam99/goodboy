import type { ReactNode } from 'react';
import { AlertCircle, ArrowUp, Check, GitCommitHorizontal } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { REMOTE_LABEL } from '../../reviewRemote';
import { ThreadGitFact as Fact } from './ThreadGitFact';
import { ThreadGitMiniDiff } from './ThreadGitMiniDiff';
import { ThreadGitSha as Sha } from './ThreadGitSha';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

const timeOf = ({ ms }: { readonly ms: number }): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
  if (entry.remote === 'folded' && git.folded !== null) {
    return (
      <>
        <Fact icon={icon}>
          <Sha sha={git.folded.sha} /> was folded into <Sha sha={git.folded.landedAs} /> on this
          branch.
        </Fact>
        <Fact icon={<ArrowUp size={ICON_SIZE.control} />}>{REMOTE_LABEL.foldedNotPushed}</Fact>
      </>
    );
  }
  if (entry.remote === 'missing' && git.missing !== null) {
    const warning = <AlertCircle size={ICON_SIZE.control} />;
    return (
      <>
        <Fact icon={warning} tone="text-warning">
          {git.missing.wasPushed ? (
            <>
              Pushed in <Sha sha={git.missing.sha} /> is no longer true: the commit is not on origin
              anymore.
            </>
          ) : (
            <>
              <Sha sha={git.missing.sha} /> is no longer on the branch or on origin.
            </>
          )}
        </Fact>
        {git.missing.isPathGone && (
          <Fact icon={warning} tone="text-warning">
            The file no longer exists on the branch.
          </Fact>
        )}
      </>
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
    {entry.remote === 'looks_fixed' && <ThreadGitMiniDiff sessionId={sessionId} entry={entry} />}
  </section>
);
