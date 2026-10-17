import { useEffect } from 'react';
import type { IsoDateTime, PrReviewDraft } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { WorktreeScene } from '../u25/c04WorktreeScene';
import { SESSION_ID } from '../resolveSeed';
import { APPLY_WEBHOOK_NOTE_LINE, APPLY_WEBHOOK_PATH, CTX_PATCH } from '../brand/contextDiffPatch';

type Internals = {
  invoke: (command: string, args?: unknown, options?: unknown) => Promise<unknown>;
};

const withPrDiff = (): void => {
  const internals = (window as unknown as { __TAURI_INTERNALS__?: Internals }).__TAURI_INTERNALS__;
  if (internals === undefined) {
    return;
  }
  const original = internals.invoke.bind(internals);
  internals.invoke = (command, args, options) =>
    command === 'gh_pr_diff' ? Promise.resolve(CTX_PATCH) : original(command, args, options);
};

const DRAFT: PrReviewDraft = {
  id: 'mock-features-write-review-draft',
  sessionId: SESSION_ID,
  provider: 'github',
  repo: 'harborline/payments-api',
  prNumber: 318,
  path: APPLY_WEBHOOK_PATH,
  line: APPLY_WEBHOOK_NOTE_LINE,
  startLine: null,
  side: 'new',
  body: 'Log the duplicate at info with the event id, so on-call can count redeliveries.',
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: '2026-09-25T09:00:00.000Z' as IsoDateTime,
};

const PANEL_TRIGGER_SELECTOR = '[data-slot="diff-toolbar"] button';
const PANEL_POLL_MS = 200;
const MODE_DELAY_MS = 500;
const PANEL_TRIES = 60;

const useOpenReviewPanel = (): void => {
  useEffect(() => {
    let tries = 0;
    const interval = window.setInterval(() => {
      tries += 1;
      const trigger = [...document.querySelectorAll<HTMLElement>(PANEL_TRIGGER_SELECTOR)].find(
        (node) => (node.textContent ?? '').trim().startsWith('Review'),
      );
      if (trigger !== undefined) {
        trigger.click();
        window.clearInterval(interval);
        return;
      }
      if (tries > PANEL_TRIES) {
        window.clearInterval(interval);
      }
    }, PANEL_POLL_MS);
    return () => window.clearInterval(interval);
  }, []);
};

const CONFIG = { variant: 'github', level: 'worktree', tab: 'files' } as const;

export const FeaturesWriteReviewScene = () => {
  useOpenReviewPanel();

  useEffect(() => {
    withPrDiff();
    useAppStore.setState({
      reviewDrafts: { [SESSION_ID]: [DRAFT] },
      loadReviewDrafts: async () => undefined,
    });
    const timer = window.setTimeout(
      () => useAppStore.setState({ pullRequestModes: { [SESSION_ID]: 'write_review' } }),
      MODE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return <WorktreeScene config={CONFIG} />;
};
