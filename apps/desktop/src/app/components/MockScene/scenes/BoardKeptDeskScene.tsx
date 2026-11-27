import { BoardShellScene } from './BoardShellScene';
import { useAppStore } from '../../../../store';

const keepDesks = (): void => {
  const { sessions } = useAppStore.getState();
  useAppStore.setState({
    sessionFace: Object.fromEntries(sessions.map((session) => [session.id, 'desk' as const])),
  });
};

export const BoardKeptDeskScene = () => <BoardShellScene afterSeed={keepDesks} />;
