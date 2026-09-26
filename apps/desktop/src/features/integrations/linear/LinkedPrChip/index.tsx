import { cn, tintClasses } from '@goodboy/ui';
import { GitPullRequest } from 'lucide-react';
import type { LinearLinkedPr } from '../client';
import { linearPrStateKind } from '../linearPrStateKind';
import {
  PULL_REQUEST_PRESENTATION,
  type PullRequestPresentation,
} from '../../../../shared/pullRequestPresentation';
import { stateDescription } from '../../../../shared/utils/statePresentation';
import { openUrl } from '../../../../shared/lib/editor';
import { EMPTY_ARRAY, useAppStore, sessionPlace } from '../../../../store';
import { selectActiveProjectPrs } from '../../../../store/slices/github/activeProjectPrs';

type Props = {
  readonly pr: LinearLinkedPr;
};

export const LinkedPrChip = ({ pr }: Props) => {
  const sessionId = useAppStore((s) => s.currentSessionId);
  const branchPrs = useAppStore((s) =>
    s.currentSessionId == null
      ? EMPTY_ARRAY
      : selectActiveProjectPrs({ state: s, sessionId: s.currentSessionId }),
  );
  const canonicalPr = useAppStore((s) =>
    s.currentSessionId == null ? null : (s.sessionGithub[s.currentSessionId]?.pr ?? null),
  );
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const navigate = useAppStore((s) => s.navigate);
  const isUnderStudio = useAppStore((s) => s.appStudio !== null);
  const sessionPr =
    branchPrs.find((candidate) => candidate.url === pr.url) ??
    (canonicalPr?.url === pr.url ? canonicalPr : null);

  const open = () => {
    if (sessionId == null || sessionPr == null || isUnderStudio) {
      void openUrl(pr.url);
      return;
    }
    void selectSessionPr(sessionId, sessionPr.number);
    navigate({ to: sessionPlace({ sessionId, lens: 'pr' }) });
  };

  const state = linearPrStateKind({ status: pr.status });
  const presentation: PullRequestPresentation | null =
    state === null ? null : PULL_REQUEST_PRESENTATION[state];
  const tint = tintClasses(presentation?.tone ?? 'neutral');
  const Icon = presentation?.icon ?? GitPullRequest;
  const description =
    presentation === null
      ? `Pull request #${pr.number}`
      : stateDescription({ presentation, subject: `PR #${pr.number}` });

  return (
    <button
      type="button"
      onClick={open}
      title={description}
      aria-label={description}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-secondary font-medium motion-safe:transition-opacity hover:opacity-80',
        tint.border,
        tint.bg,
        tint.text,
      )}
    >
      <Icon size={11} aria-hidden />#{pr.number}
      {presentation !== null ? (
        <span className="opacity-70">· {presentation.label.toLowerCase()}</span>
      ) : null}
    </button>
  );
};
