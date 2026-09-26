import { Button, Notice } from '@goodboy/ui';
import { nextWeeklyRefillAfterReset } from './resetCopy';

export type ResetOutcomeKind = 'reset' | 'nothingToReset' | 'noCredit' | 'failed';

type Props = {
  readonly outcome: ResetOutcomeKind;
  readonly usedAtMs: number;
  readonly onRetry: () => void;
};

export const ResetOutcomeNotice = ({ outcome, usedAtMs, onRetry }: Props) => {
  if (outcome === 'reset') {
    return (
      <Notice
        tone="success"
        placement="inline"
        role="status"
        title="Reset used."
        body={`Codex is at 0% for the 5-hour window and the week. Next weekly refill: ${nextWeeklyRefillAfterReset({ nowMs: usedAtMs })}.`}
      />
    );
  }
  if (outcome === 'nothingToReset') {
    return (
      <Notice
        tone="info"
        placement="inline"
        role="status"
        title="Nothing to reset right now."
        body="Codex says no window can be reset. Your reset is still yours."
      />
    );
  }
  if (outcome === 'noCredit') {
    return <Notice tone="info" placement="inline" role="status" title="No free resets left." />;
  }
  return (
    <Notice
      tone="danger"
      placement="inline"
      title="Couldn't reach Codex."
      body="Your reset wasn't used."
      actions={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
};
