import { Boxes } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';

export const NoProvidersNotice = () => {
  const openProviderSettings = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-settings', { detail: { scope: 'providers' } }),
    );
  };

  return (
    <EmptyState
      bordered
      icon={Boxes}
      size="inline"
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
