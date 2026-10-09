import { EmptyLine, Button } from '@goodboy/ui';

type Props = {
  readonly onNavigate?: () => void;
};

export const NoConnectedProviders = ({ onNavigate }: Props) => {
  const openProviderStudio = () => {
    onNavigate?.();
    window.dispatchEvent(
      new CustomEvent('goodboy:open-settings', { detail: { scope: 'providers' } }),
    );
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <EmptyLine className="flex-1 text-label text-muted-foreground">
        No providers connected
      </EmptyLine>
      <Button size="sm" onClick={openProviderStudio}>
        Open providers
      </Button>
    </div>
  );
};
