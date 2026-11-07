import type { ReactNode } from 'react';
import { BAND_ROW_CLASS, cn, ICON_SIZE } from '@goodboy/ui';
import { Check } from 'lucide-react';
import { useAppStore } from '../../../../../../../store/store';

import type { ProviderDisplayInfo } from '../../../../../providers';
import type { ConnectionTestResult } from '../../../../../../../store/slices/providers/types';
import { canTestConnection } from './canTestConnection';

type SentenceParams = {
  readonly label: string;
  readonly result: ConnectionTestResult;
};

const outcomeSentenceOf = ({ label, result }: SentenceParams): string => {
  switch (result.outcome) {
    case 'answered':
      return `${label} answered in ${(result.millis / 1000).toFixed(1)} s.`;
    case 'timed_out':
      return `${label} didn't answer in ${result.secs ?? 0} s.`;
    case 'empty':
      return `${label} returned no models.`;
    case 'unsupported':
      return `${label} has no account test.`;
    case 'refused':
      return `${label} did not accept the call: ${result.detail.split('\n')[0] ?? 'No answer'}.`;
    default: {
      const unreachable: never = result.outcome;
      return unreachable;
    }
  }
};

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly children: ReactNode;
};

export const ConnectionTest = ({ info, children }: Props) => {
  const test = useAppStore((state) => state.providerConnectionTests[info.id]);
  const result = test?.result ?? null;
  return (
    <div className="flex flex-col gap-2">
      <div className={cn(BAND_ROW_CLASS, 'gap-3 text-meta')}>{children}</div>
      {canTestConnection({ providerId: info.id }) && result !== null ? (
        <div
          role="status"
          className={cn(
            'flex items-center gap-2 px-3 text-meta',
            result.isOk ? 'text-muted-foreground' : 'text-danger',
          )}
        >
          {result.isOk ? <Check size={ICON_SIZE.row} aria-hidden /> : null}
          <span>{outcomeSentenceOf({ label: info.label, result })}</span>
        </div>
      ) : null}
    </div>
  );
};
