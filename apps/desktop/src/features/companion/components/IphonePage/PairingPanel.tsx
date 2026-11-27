import { Band } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { QrInfo } from '../../bridge';
import { PairingCode } from './PairingCode';

const PAIRING_STEPS = [
  'Open Goodboy on your iPhone.',
  'Point the camera at this code.',
  'Allow it here when it asks.',
] as const;

const NEW_PHONE_NOTE =
  'A new iPhone can read, reply, approve and merge. Starting sessions stays off. Change it per iPhone after it pairs.';

type Props = {
  readonly info: QrInfo | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly remaining: number;
  readonly total: number;
  readonly onMint: () => void;
};

export const PairingPanel = ({ info, isLoading, error, remaining, total, onMint }: Props) => (
  <Band inset="content" label={NAMES.pairIphone} ariaLabel={NAMES.pairIphone} headingLevel={2}>
    <div className="flex flex-wrap items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <PairingCode
          info={info}
          isLoading={isLoading}
          error={error}
          remaining={remaining}
          total={total}
          onMint={onMint}
        />
      </div>
      <div className="flex max-w-[22rem] flex-col gap-3">
        <ol className="flex list-inside list-decimal flex-col gap-2 text-ui text-muted-foreground">
          {PAIRING_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-meta text-muted-foreground">{NEW_PHONE_NOTE}</p>
      </div>
    </div>
  </Band>
);
