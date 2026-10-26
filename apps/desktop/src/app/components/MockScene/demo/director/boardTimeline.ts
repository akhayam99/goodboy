import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { BOARD_STORY_SESSION } from '../../scenes/BoardScene';
import type { DemoTimeline, TimelineParams } from './directorTypes';
import { installBoardActions } from './installBoardActions';
import { installBoardStory } from './installBoardStory';

export const boardTimeline = ({ state }: TimelineParams): DemoTimeline | null => {
  if (sessionById(state.sessions, BOARD_STORY_SESSION) === undefined) {
    return null;
  }
  return {
    setup: ({ store }) => {
      installBoardActions({ store });
      installBoardStory({ store });
    },
    prepare: () => undefined,
    cues: [],
  };
};
