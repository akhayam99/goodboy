import { Boxes } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { openConnection } from '../../../../connections/openConnection';

export const NoProvidersNotice = () => {
  const openProviderSettings = () => {
    openConnection({ focus: null });
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
