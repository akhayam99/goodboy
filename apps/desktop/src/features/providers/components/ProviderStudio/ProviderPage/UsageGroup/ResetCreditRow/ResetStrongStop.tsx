import { useState } from 'react';
import type { ResetAdvice } from '@goodboy/core';
import { Button, Checkbox, Notice } from '@goodboy/ui';
import { strongBody, strongConsent, strongTitle } from './resetCopy';
import { ResetSummaryBox } from './ResetSummaryBox';

type Props = {
  readonly advice: ResetAdvice;
  readonly count: number;
  readonly nowMs: number;
  readonly isBusy: boolean;
  readonly onKeep: () => void;
  readonly onConfirm: () => void;
};

export const ResetStrongStop = ({ advice, count, nowMs, isBusy, onKeep, onConfirm }: Props) => {
  const [hasConsent, setHasConsent] = useState(false);
  const title = strongTitle({ advice, nowMs });
  return (
    <div role="group" aria-label={title}>
      <Notice
        tone="danger"
        placement="inline"
        role="alert"
        title={title}
        body={strongBody({ advice, nowMs })}
      >
        <div className="flex w-full flex-col gap-3">
          <div className="flex gap-2">
            <ResetSummaryBox label="You get back" value={`${advice.weekUsedPercent}% of a week`} />
            <ResetSummaryBox
              label="Free resets left"
              value={`${count} → ${Math.max(count - 1, 0)}`}
            />
          </div>
          <Checkbox
            checked={hasConsent}
            disabled={isBusy}
            onChange={setHasConsent}
            label={strongConsent({ advice, count })}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost-danger"
              size="sm"
              disabled={!hasConsent || isBusy}
              isBusy={isBusy}
              busyLabel="Using reset"
              onClick={onConfirm}
            >
              Use reset anyway
            </Button>
            <Button size="sm" autoFocus disabled={isBusy} onClick={onKeep}>
              Keep my reset
            </Button>
          </div>
        </div>
      </Notice>
    </div>
  );
};
