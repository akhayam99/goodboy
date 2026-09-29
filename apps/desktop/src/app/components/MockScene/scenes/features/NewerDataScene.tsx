import { NewerDatabaseScreen } from '../../../BootSplash/NewerDatabaseScreen';

const restore = async (): Promise<void> => undefined;
const quit = (): void => undefined;

export const FeaturesNewerDataScene = () => (
  <NewerDatabaseScreen
    restorableSnapshot="goodboy-before-0.13.0.db"
    onRestore={restore}
    onQuit={quit}
  />
);
