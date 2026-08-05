import { useState } from 'react';
import type { WorkflowBlockReason } from '../advanceGate';
import { WORKFLOW_BLOCK_COPY } from '../blockCopy';

type Params = {
  readonly blockReason: WorkflowBlockReason | null;
  readonly title?: string;
  readonly onStart: () => void | Promise<void>;
};

export const useStartAnywayConfirm = ({
  blockReason,
  title = 'Start the next agent anyway?',
  onStart,
}: Params) => {
  const [isBusy, setIsBusy] = useState(false);
  const [isArmed, setIsArmed] = useState(false);

  const start = async () => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setIsArmed(false);
    try {
      await onStart();
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
      void start();
    },
    onConfirm: () => void start(),
    onCancel: () => setIsArmed(false),
  };
};
