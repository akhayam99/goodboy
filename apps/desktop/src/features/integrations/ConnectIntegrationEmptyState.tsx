import { Button, EmptyState } from '@goodboy/ui';
import { Plug } from 'lucide-react';

type Props = {
  readonly name: string;
  readonly compact?: boolean;
};

export const ConnectIntegrationEmptyState = ({ name, compact = false }: Props) => (
  <EmptyState
    icon={Plug}
    title={`Connect ${name}`}
    description={`Connect ${name} in Settings to use this integration.`}
    className={compact ? 'py-5' : undefined}
    action={
      <Button
        size="sm"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('goodboy:open-settings', { detail: { section: 'integrations' } }),
          )
        }
      >
        Connect
      </Button>
    }
  />
);
