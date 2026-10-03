import { Boxes } from 'lucide-react';
import { Button, LensEmptyState } from '@goodboy/ui';

export const NoProvidersNotice = () => {
  const openProviderSettings = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-settings', { detail: { scope: 'providers' } }),
    );
  };

  return (
    <LensEmptyState
      icon={Boxes}
      title="No providers connected"
      description="Keep editing and saving this workflow. Writing its steps with an agent needs a connected provider."
      action={
        <Button size="sm" onClick={openProviderSettings}>
          Open providers
        </Button>
      }
    />
  );
};
