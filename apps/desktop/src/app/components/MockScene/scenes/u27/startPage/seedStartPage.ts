import { useAppStore } from '../../../../../../store';
import {
  EMPTY_SESSION_DRAFT,
  type SessionDraft,
} from '../../../../../../store/slices/sessionDraft/state';
import { mockSceneIpc } from '../../mockSceneIpc';
import { WORKSPACE_ID, seedBoardScene } from '../../BoardScene';
import { seedStudioChrome } from '../../shellChrome';
import { START_PAGE_SEED } from './startPageSeedData';

type Params = {
  readonly draft?: Partial<SessionDraft>;
};

export const seedStartPage = ({ draft = {} }: Params = {}): void => {
  mockSceneIpc(() => undefined);
  seedBoardScene();
  seedStudioChrome();
  const { projects, phaseTemplates } = useAppStore.getState();
  const [template] = projects;
  const portal =
    template === undefined
      ? []
      : [
          {
            ...template,
            id: START_PAGE_SEED.portalId,
            name: START_PAGE_SEED.repo,
            rootPath: `~/code/harborline/${START_PAGE_SEED.repo}`,
          },
        ];
  useAppStore.setState({
    projects: [...portal, ...projects],
    phaseTemplates: {
      ...phaseTemplates,
      [WORKSPACE_ID]: [START_PAGE_SEED.preset, ...(phaseTemplates[WORKSPACE_ID] ?? [])],
    },
    loadPhaseTemplates: async () => undefined,
    sessionDrafts: {
      [WORKSPACE_ID]: {
        ...EMPTY_SESSION_DRAFT,
        ...draft,
      },
    },
    openSessionDraftWorkspaceId: WORKSPACE_ID,
    currentSessionId: null,
  });
};
