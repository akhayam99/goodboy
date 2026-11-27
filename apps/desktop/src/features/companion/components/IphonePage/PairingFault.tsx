import { Button, Notice } from '@goodboy/ui';
import { actionIntentOf } from '../../../actions/actionIntentOf';
import type { BridgeFault } from '../../bridge';

type Props = {
  readonly fault: BridgeFault;
  readonly isBusy: boolean;
  readonly onReset: () => Promise<void>;
};

export const PairingFault = ({ fault, isBusy, onReset }: Props) => (
  <Notice
    tone="danger"
    placement="inline"
    role="alert"
    title="Pairing isn't available"
    body={fault.message}
    actions={
      <Button
        variant="secondary"
        size="sm"
        intent={actionIntentOf({ verb: 'reset' })}
        disabled={isBusy}
        onClick={() => void onReset()}
      >
        Reset pairing
      </Button>
    }
  />
);
