import { useState } from 'react';
import { Button, Notice, type NoticeTone } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = {
  readonly tone: NoticeTone;
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
    <Notice
      tone={tone}
      placement="inline"
      role="alert"
      title="Couldn't read ports"
      detail={detail}
      actions={
        <Button size="sm" variant="secondary" isBusy={isBusy} onClick={() => void retry()}>
          Retry
        </Button>
      }
    />
  );
};
