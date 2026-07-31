import { TriangleAlert } from 'lucide-react';
import { Button, cn, tintClasses } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL_LOWER } from '../../../../features/providers/providers';
import { TranscriptShell } from '../TranscriptShell';

const warningTint = tintClasses('warning');

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
    <TranscriptShell tone="warning" variant="boxed" emphasis className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <TriangleAlert
          size={14}
          aria-hidden
          className={cn('shrink-0 translate-y-0.5', warningTint.icon)}
        />
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] font-medium leading-relaxed text-foreground">
              {label} is not signed in.
            </p>
            {identity ? (
              <p className="text-xs text-muted-foreground">last known identity: {identity}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
