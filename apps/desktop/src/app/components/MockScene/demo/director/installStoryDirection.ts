import { seedStoryAsking } from '../../scenes/story/storyWorld';
import type { AppStore } from '../../../../../store/store';
import { createStoryAnswer } from './createStoryAnswer';
import type { DirectorStore } from './directorTypes';
import { installDemoWorld } from './installDemoWorld';

type Params = {
  readonly store: DirectorStore;
};

export const installStoryDirection = ({ store }: Params): void => {
  installDemoWorld({ store });
  const openDraft = store.getState().openSessionDraft;
  const openSessionDraft = (() => {
    const { currentWorkspaceId, patchSessionDraft } = store.getState();
    if (currentWorkspaceId !== null) {
      patchSessionDraft({
        workspaceId: currentWorkspaceId,
        patch: {
          hasChosenStart: true,
          startKind: 'workflow',
          startShape: 'orchestrated',
          autonomy: 'plan',
        },
      });
    }
    openDraft();
  }) satisfies AppStore['openSessionDraft'];
  const startSessionFromDraft = (async () => {
    const session = seedStoryAsking();
    if (session === null) {
      throw new Error('The story workspace is missing');
    }
    return session;
  }) satisfies AppStore['startSessionFromDraft'];
  store.setState({
    openSessionDraft,
    startSessionFromDraft,
    answerOpenQuestions: createStoryAnswer({ store }),
  });
};
