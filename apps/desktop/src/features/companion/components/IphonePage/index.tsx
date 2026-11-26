import { Band, Button, Notice, PaneShell } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { BridgeStatus } from '../../bridge';
import { NetworkChoice } from './NetworkChoice';
import { PairedDevices } from './PairedDevices';
import { PairingCode } from './PairingCode';
import { useIphonePairing } from './useIphonePairing';

const PAIRING_STEPS = ['Open Goodboy on your iPhone.', 'Point the camera at this code.'];

const NEW_PHONE_NOTE =
  'A new iPhone can read, reply, approve and merge. Starting sessions stays off. Change it per iPhone after it pairs.';

type StopFailure = {
  readonly title: string;
  readonly error: unknown;
};

type Props = {
  readonly animationClassName: string;
  readonly onStopFailed: (failure: StopFailure) => void;
};

type MetaParams = {
  readonly status: BridgeStatus | null;
  readonly isShowingCode: boolean;
};

const metaOf = ({ status, isShowingCode }: MetaParams): string | undefined => {
  if (status === null) {
    return undefined;
  }
  if (isShowingCode) {
    return 'Pairing';
  }
  return `${status.enrolledCount} paired`;
};

export const IphonePage = ({ animationClassName, onStopFailed }: Props) => {
  const {
    info,
    status,
    error,
    isLoading,
    isRevoking,
    phones,
    interfaces,
    isChanging,
    changeError,
    remaining,
    total,
    enrolled,
    isPaired,
    isShowingCode,
    mint,
    revoke,
    revokeOne,
    setPermissions,
    toggleInterface,
    pair,
    cancel,
  } = useIphonePairing({ onStopFailed });

  const pairButton = (
    <Button variant="secondary" size="sm" onClick={pair}>
      {NAMES.pairIphone}
    </Button>
  );
  const cancelButton = isPaired ? (
    <Button variant="ghost" size="sm" onClick={cancel}>
      Cancel
    </Button>
  ) : undefined;

  return (
    <PaneShell
      page="settings"
      animationClassName={animationClassName}
      title={NAMES.iphone}
      meta={metaOf({ status, isShowingCode })}
      actions={isShowingCode ? cancelButton : pairButton}
    >
      {isShowingCode ? (
        <>
          <Band
            inset="content"
            label={NAMES.pairIphone}
            ariaLabel={NAMES.pairIphone}
            headingLevel={2}
          >
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex flex-col items-center gap-3">
                <PairingCode
                  info={info}
                  isLoading={isLoading}
                  error={error}
                  remaining={remaining}
                  total={total}
                  onMint={() => void mint()}
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
          <Band inset="content" label="Networks" ariaLabel="Networks" headingLevel={2}>
            <NetworkChoice
              interfaces={interfaces}
              isBusy={isChanging || isLoading}
              onToggle={toggleInterface}
            />
          </Band>
          <Notice
            tone="info"
            placement="inline"
            title="Goodboy for iPhone is in private testing"
            body="It can't be downloaded yet. Pairing works with a build you already have."
          />
        </>
      ) : (
        <>
          {changeError === null ? null : (
            <Notice tone="danger" placement="inline" title={changeError} />
          )}
          {error === null ? null : <Notice tone="danger" placement="inline" title={error} />}
          <Band inset="content" label="Paired iPhones" ariaLabel="Paired iPhones" headingLevel={2}>
            <PairedDevices
              enrolled={enrolled}
              phones={phones}
              now={Date.now()}
              isBusy={isRevoking || isChanging}
              onSetPermissions={setPermissions}
              onRevokeOne={revokeOne}
              onRevokeAll={revoke}
            />
          </Band>
          <Band inset="content" label="Networks" ariaLabel="Networks" headingLevel={2}>
            <NetworkChoice
              interfaces={interfaces}
              isBusy={isChanging || isLoading}
              onToggle={toggleInterface}
            />
          </Band>
        </>
      )}
    </PaneShell>
  );
};
