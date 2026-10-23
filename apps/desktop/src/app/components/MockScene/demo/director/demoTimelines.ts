import type { DemoTimeline, TimelineParams } from './directorTypes';
import { agentTimeline } from './agentTimeline';
import { runTimeline } from './runTimeline';
import { boardTimeline } from './boardTimeline';

export const DEMO_TIMELINES: ReadonlyMap<string, (params: TimelineParams) => DemoTimeline | null> =
  new Map([
    ['chat-shell', agentTimeline],
    ['c08-run-working', runTimeline],
    ['board-shell', boardTimeline],
  ]);
