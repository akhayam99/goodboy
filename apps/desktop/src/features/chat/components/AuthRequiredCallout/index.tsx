import { Button } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL_LOWER } from '../../../../features/providers/providers';
import { TranscriptShell } from '../TranscriptShell';
import { MARKER_ACCENT } from '../marker-accents';

const accent = MARKER_ACCENT.warning;

type Props = {
  readonly providerId: ProviderId;
  readonly identity?: string | null;
  readonly onRefresh: () => void;
};

export const AuthRequiredCallout = ({ providerId, identity, onRefresh }: Props) => {
  const label = PROVIDER_LABEL_LOWER[providerId];

  const onConnect = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-provider-studio', {
        detail: { providerId, action: 'login' },
      }),
    );
  };

  return (
    <TranscriptShell tone="warning" variant="boxed" className="text-sm">
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 ${accent.icon}`}>⚠</span>
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
    </TranscriptShell>
  );
};
