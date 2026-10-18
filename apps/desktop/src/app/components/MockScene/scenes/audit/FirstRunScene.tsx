import { WorkspaceLauncher } from '../../../../../features/workspace/components/WorkspaceLauncher';

const noop = () => undefined;

export const FirstRunScene = () => (
  <div className="relative h-screen w-screen bg-background">
    <WorkspaceLauncher isCreating onCloseCreate={noop} onOfferRepo={noop} />
  </div>
);
