import { nowIso } from '../../../../../store/slices/project-mounts/nowIso';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import type { AppStore } from '../../../../../store/store';
import { STORY_PLANNER_ID, STORY_ROOT_ID, seedStoryShell } from '../../scenes/story/storyWorld';
import { createStoryAnswer } from './createStoryAnswer';
import { demoRuns } from './demoRunRegistry';
import type { DirectorStore } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';
import { scheduleCues } from './scheduleCues';
import { storyBriefCues } from './storyBriefCues';
import { storyStartCues } from './storyStartCues';

type Params = {
  readonly store: DirectorStore;
};

export const installStoryDirection = ({ store }: Params): void => {
  installDemoWorld({ store });
  const openDraft = store.getState().openSessionDraft;
  let cancelBrief: (() => void) | null = null;
  const openSessionDraft = (() => {
    const { currentWorkspaceId, patchSessionDraft } = store.getState();
    if (currentWorkspaceId === null) {
      openDraft();
      return;
    }
    patchSessionDraft({
      workspaceId: currentWorkspaceId,
      patch: {
        hasChosenStart: true,
        startKind: 'workflow',
        startShape: 'orchestrated',
        autonomy: 'plan',
      },
    });
    const brief = selectSessionDraft({
      state: store.getState(),
      workspaceId: currentWorkspaceId,
    }).workflowGoal;
    if (cancelBrief === null && brief.trim() !== '') {
      patchSessionDraft({ workspaceId: currentWorkspaceId, patch: { workflowGoal: '' } });
      cancelBrief = scheduleCues({
        store,
        now: () => nowIso({}),
        cues: storyBriefCues({
          workspaceId: currentWorkspaceId,
          brief,
          onDone: () => {
            cancelBrief = null;
          },
        }),
      });
    }
    openDraft();
  }) satisfies AppStore['openSessionDraft'];
  const startSessionFromDraft = (async () => {
    cancelBrief?.();
    cancelBrief = null;
    const session = seedStoryShell();
    if (session === null) {
      throw new Error('The story workspace is missing');
    }
    const cancelStart = scheduleCues({
      store,
      now: () => nowIso({}),
      cues: storyStartCues(),
      agentId: STORY_ROOT_ID,
    });
    demoRuns.track({ agentId: STORY_PLANNER_ID, cancel: cancelStart });
    return session;
  }) satisfies AppStore['startSessionFromDraft'];
  store.setState({
    openSessionDraft,
    startSessionFromDraft,
    answerOpenQuestions: createStoryAnswer({ store }),
  });
};
