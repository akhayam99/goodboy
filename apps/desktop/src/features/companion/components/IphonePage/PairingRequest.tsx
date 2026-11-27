import { Button, Notice } from '@goodboy/ui';
import type { PendingPairing } from '../../bridge';

type DecideParams = {
  readonly id: string;
  readonly isAllowed: boolean;
};

type Props = {
  readonly pending: PendingPairing;
  readonly isBusy: boolean;
  readonly onDecide: (params: DecideParams) => Promise<void>;
};

export const PairingRequest = ({ pending, isBusy, onDecide }: Props) => (
  <Notice
    tone="warning"
    placement="inline"
    role="alert"
    title="An iPhone wants to pair"
    body={`${pending.name} scanned your code. Allow it only if it is yours.`}
    actions={
      <>
        <Button
          variant="primary"
          size="sm"
          disabled={isBusy}
          onClick={() => void onDecide({ id: pending.id, isAllowed: true })}
        >
          Allow
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isBusy}
          onClick={() => void onDecide({ id: pending.id, isAllowed: false })}
        >
          Deny
        </Button>
      </>
    }
  />
);
