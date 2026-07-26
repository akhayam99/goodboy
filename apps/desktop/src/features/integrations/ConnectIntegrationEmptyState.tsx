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

const STUDIO_EVENTS: Record<Props['provider'], string> = {
  linear: 'goodboy:open-linear-studio',
  sentry: 'goodboy:open-sentry-studio',
  gitlab: 'goodboy:open-gitlab-studio',
};

export const ConnectIntegrationEmptyState = ({ provider, compact = false }: Props) => (
  <EmptyState
    icon={Plug}
    title={`Connect ${PROVIDER_NAMES[provider]}`}
    description={`Open the ${PROVIDER_NAMES[provider]} studio to connect this integration.`}
    className={compact ? 'py-5' : undefined}
    action={
      <Button
        size="sm"
        onClick={() => window.dispatchEvent(new CustomEvent(STUDIO_EVENTS[provider]))}
      >
        Connect
      </Button>
    }
  />
);
