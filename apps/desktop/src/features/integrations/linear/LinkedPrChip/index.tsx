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
import { useAppStore } from '../../../../store';
import { selectSessionForPr } from '../../../../store/slices/github/selectSessionForPr';

type Props = {
  readonly pr: LinearLinkedPr;
};

export const LinkedPrChip = ({ pr }: Props) => {
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const workspaceId = useAppStore((s) => s.currentWorkspaceId);
  const sessionMatch = useAppStore((s) =>
    workspaceId == null ? null : selectSessionForPr({ state: s, workspaceId, url: pr.url }),
  );
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const reportError = useAppStore((s) => s.reportError);

  const open = () => {
    if (sessionMatch == null) {
      void openUrl(pr.url);
      return;
    }
    const { sessionId, number } = sessionMatch;
    if (sessionId === currentSessionId) {
      void selectSessionPr(sessionId, number);
      setActiveLens(sessionId, 'pr');
      return;
    }
    void (async () => {
      await setCurrentSession(sessionId);
      await selectSessionPr(sessionId, number);
      setActiveLens(sessionId, 'pr');
    })().catch((error: unknown) => {
      void reportError({ title: "Couldn't open this pull request", error });
    });
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
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium motion-safe:transition-opacity hover:opacity-80',
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
