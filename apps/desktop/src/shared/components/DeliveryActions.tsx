import type { ComponentProps, ReactElement } from 'react';
import { Button, KeyHint, Tooltip } from '@goodboy/ui';

type Props = {
  readonly canSend: boolean;
  readonly isQueueSubmit?: boolean;
  readonly queueKeys?: string;
  readonly readNowKeys?: string;
  readonly queueHint?: string;
  readonly readNowHint?: string;
  readonly queueTestId?: string;
  readonly readNowTestId?: string;
  readonly readNowLabel?: string;
  readonly onQueue?: () => void;
  readonly onReadNow: () => void;
};

type HintedParams = {
  readonly hint: string | undefined;
  readonly button: ReactElement<ComponentProps<typeof Button>>;
};

const hinted = ({ hint, button }: HintedParams) =>
  hint === undefined ? (
    button
  ) : (
    <Tooltip content={hint} side="top">
      {button}
    </Tooltip>
  );

export const DeliveryActions = ({
  canSend,
  isQueueSubmit = false,
  queueKeys,
  readNowKeys,
  queueHint,
  readNowHint,
  queueTestId,
  readNowTestId,
  readNowLabel = 'Read now',
  onQueue,
  onReadNow,
}: Props) => (
  <>
    {hinted({
      hint: readNowHint,
      button: (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={canSend === false}
          data-testid={readNowTestId}
          onClick={onReadNow}
        >
          {readNowLabel}
          {readNowKeys === undefined ? null : <KeyHint keys={readNowKeys} />}
        </Button>
      ),
    })}
    {hinted({
      hint: queueHint,
      button: (
        <Button
          type={isQueueSubmit ? 'submit' : 'button'}
          size="sm"
          variant="primary"
          disabled={canSend === false}
          data-testid={queueTestId}
          onClick={isQueueSubmit ? undefined : onQueue}
        >
          Queue
          {queueKeys === undefined ? null : <KeyHint keys={queueKeys} isOnTone />}
        </Button>
      ),
    })}
  </>
);
