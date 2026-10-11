import { useAppStore } from '../../../../../../store';
import { sceneClock } from '../../../sceneClock';
import { BoardScene, WORKSPACE_ID, seedBoardScene } from '../../BoardScene';

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const seedBoardNoOngoing = (): void => {
  seedBoardScene();
  useAppStore.setState({
    starredIssues: {
      [WORKSPACE_ID]: [
        {
          workspaceId: WORKSPACE_ID,
          provider: 'linear',
          externalId: 'mock-ongoing-hbl-400',
          identifier: 'HBL-400',
          container: null,
          title: 'Payments revamp',
          url: 'https://example.invalid/linear/HBL-400',
          state: 'open',
          stateLabel: null,
          starredAt: clock.iso({ at: '2026-09-20T09:00:00.000Z' }),
          refreshedAt: null,
        },
      ],
    },
  });
};

export const BoardNoOngoingScene = () => <BoardScene seed={seedBoardNoOngoing} />;
