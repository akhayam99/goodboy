import type { ResetAdvice } from '@goodboy/core';
import { Button, Notice } from '@goodboy/ui';
import { normalBody, nowSummary } from './resetCopy';
import { ResetSummaryBox } from './ResetSummaryBox';

type Props = {
  readonly advice: ResetAdvice;
  readonly nowMs: number;
  readonly isBusy: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

const TITLE = 'Use your free reset now?';

export const ResetConfirm = ({ advice, nowMs, isBusy, onCancel, onConfirm }: Props) => (
  <div role="group" aria-label={TITLE}>
    <Notice tone="warning" placement="inline" title={TITLE} body={normalBody({ advice, nowMs })}>
      <div className="flex w-full flex-col gap-3">
        <div className="flex gap-2">
          <ResetSummaryBox label="Now" value={nowSummary({ advice })} />
          <ResetSummaryBox label="After" value="5h 0% · week 0%" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={isBusy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="warning"
            size="sm"
            isBusy={isBusy}
            busyLabel="Using reset"
            onClick={onConfirm}
          >
            Use reset
          </Button>
        </div>
      </div>
    </Notice>
  </div>
);
