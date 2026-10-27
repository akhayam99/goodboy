import { Boxes } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { openSettings } from '../../../../settings/openSettings';

export const NoProvidersNotice = () => {
  const openProviderSettings = () => {
    openSettings({ scope: 'providers' });
  };

  return (
    <EmptyState
      size="section"
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
