import { useState } from 'react';
import { ErrorStrip } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly tone: 'danger' | 'warning';
  readonly detail: string | null;
};

export const ReadFailedNotice = ({ tone, detail }: Props) => {
  const refresh = useAppStore((state) => state.refreshMonitorSnapshot);
  const [isBusy, setIsBusy] = useState(false);

  const retry = async (): Promise<void> => {
    setIsBusy(true);
    try {
      await refresh();
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ErrorStrip
      labels={['ports']}
      tone={tone}
      error={new Error(detail ?? '')}
      isBusy={isBusy}
      onRetry={() => void retry()}
    />
  );
};
