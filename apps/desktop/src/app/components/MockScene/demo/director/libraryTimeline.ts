import type { DemoTimeline, TimelineParams } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';
import { installStoryWorld } from './installStoryWorld';

export const libraryTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  const { currentSessionId: sessionId } = state;
  if (sessionId === null) {
    return null;
  }
  return {
    setup: ({ store }) => {
      installDemoWorld({ store });
      installStoryWorld({ store, sessionId });
    },
    prepare: () => undefined,
    cues: [],
  };
};
