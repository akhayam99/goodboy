import { useAppStore } from '../../../../../store';
import { seedBoardScene } from '../BoardScene';

export const seedPrSlotBoard = (): void => {
  seedBoardScene();
  useAppStore.setState({ sessionGithub: {} });
};
