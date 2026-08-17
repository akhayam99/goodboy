import { Button } from '@goodboy/ui';

type Props = {
  readonly onNavigate?: () => void;
};

export const NoConnectedProviders = ({ onNavigate }: Props) => {
  const openProviderStudio = () => {
    onNavigate?.();
    window.dispatchEvent(new CustomEvent('goodboy:open-provider-studio'));
  };

  return (
    <div className="flex items-center gap-2 px-2.5 py-2">
      <p className="flex-1 text-xs text-muted-foreground">No providers connected</p>
      <Button size="sm" onClick={openProviderStudio}>
        Open providers
      </Button>
    </div>
  );
};
