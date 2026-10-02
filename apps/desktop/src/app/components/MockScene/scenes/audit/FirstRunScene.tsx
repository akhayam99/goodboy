import { NoWorkspaceScreen } from '../../../AppEmptyState';

const noop = () => undefined;

export const FirstRunScene = () => (
  <div className="relative h-screen w-screen bg-background">
    <NoWorkspaceScreen onAddWorkspace={noop} startOpen />
  </div>
);
