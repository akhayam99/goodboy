import { useState } from 'react';
import type { WorkflowBlockReason } from '../advanceGate';
import { WORKFLOW_BLOCK_COPY } from '../blockCopy';

type StartParams = {
  readonly isConfirmed: boolean;
};

type Params = {
  readonly blockReason: WorkflowBlockReason | null;
  readonly title?: string;
  readonly onStart: (params: StartParams) => void | Promise<void>;
};

export const useStartAnywayConfirm = ({
  blockReason,
  title = 'Start the next agent anyway?',
  onStart,
}: Params) => {
  const [isBusy, setIsBusy] = useState(false);
  const [isArmed, setIsArmed] = useState(false);

  const start = async ({ isConfirmed }: StartParams) => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setIsArmed(false);
    try {
      await onStart({ isConfirmed });
    } finally {
      setIsBusy(false);
    }
  };

  return {
    isBusy,
    isConfirming: isArmed && blockReason != null,
    title,
    description: blockReason != null ? WORKFLOW_BLOCK_COPY[blockReason] : '',
    confirmLabel: 'Start anyway',
    cancelLabel: 'Wait',
    onTrigger: () => {
      if (blockReason != null) {
        setIsArmed(true);
        return;
      }
      void start({ isConfirmed: false });
    },
    onConfirm: () => void start({ isConfirmed: true }),
    onCancel: () => setIsArmed(false),
  };
};
