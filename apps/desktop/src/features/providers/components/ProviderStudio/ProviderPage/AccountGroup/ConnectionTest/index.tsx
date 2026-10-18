import type { ReactNode } from 'react';
import { BAND_ROW_CLASS, cn } from '@goodboy/ui';
import { Check } from 'lucide-react';
import { useAppStore } from '../../../../../../../store/store';
import { ICON_SIZE } from '../../../../../../../shared/components/conceptIcons';
import type { ProviderDisplayInfo } from '../../../../../providers';
import { canTestConnection } from './canTestConnection';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly children: ReactNode;
};

export const ConnectionTest = ({ info, children }: Props) => {
  const test = useAppStore((state) => state.providerConnectionTests[info.id]);
  const result = test?.result ?? null;
  return (
    <div className="flex flex-col gap-2">
      <div className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>{children}</div>
      {canTestConnection({ providerId: info.id }) && result !== null ? (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 px-3 text-label',
            result.isOk ? 'text-muted-foreground' : 'text-danger',
          )}
        >
          {result.isOk ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
          <span>
            {result.isOk
              ? `${info.label} answered in ${(result.millis / 1000).toFixed(1)} s.`
              : `${info.label} did not accept the call: ${result.detail.split('\n')[0] ?? 'No answer'}.`}
          </span>
        </div>
      ) : null}
    </div>
  );
};
