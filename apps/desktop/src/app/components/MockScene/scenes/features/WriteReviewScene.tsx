import { useEffect, useState } from 'react';
import type { IsoDateTime, PrReviewDraft } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CodeLayersScene } from '../CodeLayersScene';
import { SESSION_ID } from '../resolveSeed';
import { useSceneClicks } from '../audit/useSceneClicks';
import { APPLY_WEBHOOK_NOTE_LINE, APPLY_WEBHOOK_PATH, CTX_PATCH } from '../brand/contextDiffPatch';

const LABELS: ReadonlyArray<string> = ['Write review'];

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

const useScrollToVerdict = (): void => {
  useEffect(() => {
    let tries = 0;
    const interval = window.setInterval(() => {
      tries += 1;
      const target = [...document.querySelectorAll('button')].find((node) =>
        (node.textContent ?? '').trim().startsWith('Submit comments'),
      );
      if (target !== undefined) {
        target.scrollIntoView({ block: 'center' });
        window.clearInterval(interval);
        return;
      }
      if (tries > 80) {
        window.clearInterval(interval);
      }
    }, 200);
    return () => window.clearInterval(interval);
  }, []);
};

export const FeaturesWriteReviewScene = () => {
  const [isReady, setIsReady] = useState(false);
  useScrollToVerdict();

  useEffect(() => {
    withPrDiff();
    useAppStore.setState({ reviewDrafts: { [SESSION_ID]: [DRAFT] } });
    const timer = window.setTimeout(() => setIsReady(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useSceneClicks({
    isReady,
    labels: LABELS,
    selector: 'button',
    match: 'prefix',
    intervalMs: 200,
  });

  return <CodeLayersScene />;
};
