import type { DemoTimeline, TimelineParams } from './directorTypes';
import { agentTimeline } from './agentTimeline';
import { boardTimeline } from './boardTimeline';
import { autoTimeline } from './autoTimeline';
import { issueTimeline } from './issueTimeline';
import { libraryTimeline } from './libraryTimeline';
import { worldTimeline } from './worldTimeline';
import { presetTimeline } from './presetTimeline';
import { resolveTimeline } from './resolveTimeline';
import { storageTimeline } from './storageTimeline';

export const DEMO_TIMELINES: ReadonlyMap<string, (params: TimelineParams) => DemoTimeline | null> =
  new Map([
    ['chat-shell', agentTimeline],
    ['board-shell', boardTimeline],
    ['c07-auto-start', autoTimeline],
    ['c07-auto-plan', autoTimeline],
    ['c07-auto-working', autoTimeline],
    ['c07-auto-child-done', autoTimeline],
    ['artifacts-lens-shell', libraryTimeline],
    ['artifact-report', worldTimeline],
    ['brand-diff', worldTimeline],
    ['resolve-queue-shell', resolveTimeline],
    ['resolve-fix-ready', resolveTimeline],
    ['demo-issue', issueTimeline],
    ['demo-run', presetTimeline],
    ['demo-storage', storageTimeline],
  ]);
