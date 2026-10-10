import type { ReactNode } from 'react';
import { BAND_ROW_CLASS, Button, cn } from '@goodboy/ui';
import { Check } from 'lucide-react';
import { useAppStore } from '../../../../../../../store/store';
import { ICON_SIZE } from '../../../../../../../shared/components/conceptIcons';
import type { ProviderDisplayInfo } from '../../../../../providers';
import { ConnectionHistory } from '../ConnectionHistory';

type Props = {
  readonly info: ProviderDisplayInfo;
  readonly onReauth: () => void;
  readonly children: ReactNode;
};

export const ConnectionTest = ({ info, onReauth, children }: Props) => {
  const testProviderConnection = useAppStore((state) => state.testProviderConnection);
  const test = useAppStore((state) => state.providerConnectionTests[info.id]);
  const canTest = info.id === 'anthropic' || info.id === 'codex' || info.id === 'cursor';
  const result = test?.result ?? null;
  const isTesting = test?.isTesting === true;
  return (
    <div className="flex flex-col gap-2">
      <div className={cn(BAND_ROW_CLASS, 'gap-3 text-label')}>
        {children}
        {canTest ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={isTesting}
            onClick={() => void testProviderConnection({ providerId: info.id })}
          >
            {isTesting ? 'Testing...' : 'Test connection'}
          </Button>
        ) : null}
        <ConnectionHistory providerId={info.id} label={info.label} />
      </div>
      {canTest && result !== null ? (
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
          {!result.isOk ? (
            <Button variant="ghost" size="sm" onClick={onReauth}>
              Sign in again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
