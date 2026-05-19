import { Button } from '@kay-am/ui';
import type { ProviderId } from '@kay-am/types';
import { PROVIDER_LABEL_LOWER, providerAction } from '../../../../features/providers/providers';

interface AuthRequiredCalloutProps {
  readonly providerId: ProviderId;
  readonly identity?: string | null;
  readonly onRefresh: () => void;
}

export function AuthRequiredCallout({ providerId, identity, onRefresh }: AuthRequiredCalloutProps) {
  const label = PROVIDER_LABEL_LOWER[providerId];

  const onConnect = () => {
    void providerAction(providerId, 'login');
  };

  return (
    <div className="rounded-md border border-warning/40 bg-warning/5 px-3 py-3 text-sm">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-warning">⚠</span>
        <div className="flex-1">
          <p className="font-medium text-foreground">{label} is not signed in.</p>
          {identity ? (
            <p className="mt-0.5 text-xs text-muted-foreground">last known identity: {identity}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={onConnect}>
              Connect now ↗
            </Button>
            <Button size="sm" variant="ghost" onClick={onRefresh}>
              Refresh status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
