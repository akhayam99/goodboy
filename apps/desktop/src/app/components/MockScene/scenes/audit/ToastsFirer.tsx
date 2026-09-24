import { useEffect, useRef } from 'react';
import { useToast } from '../../../Toast';

const noop = () => undefined;

const CONTEXT = 'Harborline · Retry failed refunds in ledger-core';
const OVERFLOW_ATTEMPTS = [1, 2, 3, 4, 5];

type Props = {
  readonly variant: string;
};

export const ToastsFirer = ({ variant }: Props) => {
  const { showToast, previewNotification } = useToast();
  const hasFired = useRef(false);
  useEffect(() => {
    if (hasFired.current) {
      return;
    }
    hasFired.current = true;
    if (variant === 'overflow') {
      for (const attempt of OVERFLOW_ATTEMPTS) {
        previewNotification({
          severity: 'error',
          message: `Couldn't reach the Codex CLI (attempt ${attempt}).`,
          title: 'Step summary failed',
          context: CONTEXT,
          persist: true,
          action: { label: 'Retry', onClick: noop },
        });
      }
      return;
    }
    if (variant === 'raw') {
      showToast({ kind: 'warning', message: 'The limit is 10 attachments.' });
      showToast({ kind: 'info', message: 'Scout 2 was deleted and can no longer be opened.' });
      previewNotification({
        severity: 'error',
        title: "Couldn't remove the worktree for ledger-core",
        message:
          "Git refused: '/mock/harborline/sessions/ledger-core-refund-retry' contains modified or untracked files, use --force to delete it",
        context: CONTEXT,
        persist: true,
      });
      return;
    }
    showToast({
      kind: 'success',
      message: 'Filed on GitHub, under your account.',
      title: 'Issue sent',
      action: { label: 'View issue', onClick: noop },
    });
    showToast({
      kind: 'info',
      message: 'An agent is rebasing this branch on main. You can keep working.',
      title: 'Rebase started',
      action: { label: 'Open the rebase agent', onClick: noop },
    });
    showToast({
      kind: 'info',
      message: 'An agent is drafting the merge request. You can keep working.',
      title: 'Agent started',
      action: { label: 'Open the agent', onClick: noop },
    });
    showToast({ kind: 'info', message: 'Bash is denied for the rest of this session.' });
    previewNotification({
      severity: 'error',
      message: 'The summarizer timed out after 90s.',
      title: 'Handoff degraded',
      context: CONTEXT,
      persist: true,
      action: { label: 'Retry', onClick: noop },
    });
  }, [previewNotification, showToast, variant]);
  return null;
};
