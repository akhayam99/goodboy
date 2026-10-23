import type { DemoTimeline, TimelineParams } from './directorTypes';
import { agentTimeline } from './agentTimeline';
import { runTimeline } from './runTimeline';
import { boardTimeline } from './boardTimeline';
import { autoTimeline } from './autoTimeline';
import { runFlowTimeline } from './runFlowTimeline';
import { worldTimeline } from './worldTimeline';

export const DEMO_TIMELINES: ReadonlyMap<string, (params: TimelineParams) => DemoTimeline | null> =
  new Map([
    ['chat-shell', agentTimeline],
    ['c08-run-working', runTimeline],
    ['c08-run-ready', runFlowTimeline],
    ['c08-run-approval', runFlowTimeline],
    ['c08-run-done', runFlowTimeline],
    ['board-shell', boardTimeline],
    ['c07-auto-start', autoTimeline],
    ['c07-auto-plan', autoTimeline],
    ['c07-auto-working', autoTimeline],
    ['c07-auto-child-done', autoTimeline],
    ['artifacts-lens-shell', worldTimeline],
    ['artifact-report', worldTimeline],
  ]);
