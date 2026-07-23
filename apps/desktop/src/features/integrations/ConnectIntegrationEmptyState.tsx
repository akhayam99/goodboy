import { Button, EmptyState } from '@goodboy/ui';
import { Plug } from 'lucide-react';

type Props = {
  readonly provider: 'linear' | 'sentry' | 'gitlab';
  readonly compact?: boolean;
};

const PROVIDER_NAMES: Record<Props['provider'], string> = {
  linear: 'Linear',
  sentry: 'Sentry',
  gitlab: 'GitLab',
};

export const ConnectIntegrationEmptyState = ({ provider, compact = false }: Props) => (
  <EmptyState
    icon={Plug}
    title={`Connect ${PROVIDER_NAMES[provider]}`}
    description={`Connect ${PROVIDER_NAMES[provider]} in Settings to use this integration.`}
    className={compact ? 'py-5' : undefined}
    action={
      <Button
        size="sm"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent('goodboy:open-workspace-settings', {
              detail: { section: 'integrations' },
            }),
          )
        }
      >
        Connect
      </Button>
    }
  />
);
