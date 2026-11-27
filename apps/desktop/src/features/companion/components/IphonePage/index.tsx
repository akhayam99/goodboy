import { Button, Notice, PaneShell } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { BridgeStatus } from '../../bridge';
import { TESTFLIGHT_LINK } from '../../testflightLink';
import { BarIconSwitch } from './BarIconSwitch';
import { IphoneIntro } from './IphoneIntro';
import { ListenerSection } from './ListenerSection';
import { PairedDevices } from './PairedDevices';
import { PairingFault } from './PairingFault';
import { PairingPanel } from './PairingPanel';
import { PairingRequest } from './PairingRequest';
import { TestflightBlock } from './TestflightBlock';
import { useIphonePairing } from './useIphonePairing';

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
  if (status.enrolledCount === 0) {
    return undefined;
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
    decidePairing,
    resetPairing,
    pair,
    cancel,
  } = useIphonePairing({ onStopFailed });

  const fault = status?.fault ?? null;
  const pending = status?.pendingPairing ?? null;
  const notices = (
    <>
      {fault === null ? null : (
        <PairingFault fault={fault} isBusy={isChanging} onReset={resetPairing} />
      )}
      {pending === null ? null : (
        <PairingRequest pending={pending} isBusy={isChanging} onDecide={decidePairing} />
      )}
      {changeError === null ? null : (
        <Notice tone="danger" placement="inline" title={changeError} />
      )}
    </>
  );
  const listener = (
    <ListenerSection
      status={status}
      interfaces={interfaces}
      isBusy={isChanging || isLoading}
      onToggle={toggleInterface}
    />
  );
  const actions = isShowingCode ? (
    <Button variant="ghost" size="sm" onClick={cancel}>
      Cancel
    </Button>
  ) : (
    <Button
      variant={isPaired || pending !== null ? 'secondary' : 'primary'}
      size="sm"
      onClick={pair}
    >
      {NAMES.pairIphone}
    </Button>
  );

  return (
    <PaneShell
      page="settings"
      animationClassName={animationClassName}
      title={NAMES.iphone}
      meta={metaOf({ status, isShowingCode })}
      actions={actions}
    >
      {notices}
      {isShowingCode ? (
        <>
          <PairingPanel
            info={info}
            isLoading={isLoading}
            error={error}
            remaining={remaining}
            total={total}
            onMint={() => void mint()}
          />
          {listener}
        </>
      ) : (
        <>
          {error === null ? null : <Notice tone="danger" placement="inline" title={error} />}
          {isPaired ? (
            <>
              <PairedDevices
                enrolled={enrolled}
                phones={phones}
                now={Date.now()}
                isBusy={isRevoking || isChanging}
                onSetPermissions={setPermissions}
                onRevokeOne={revokeOne}
                onRevokeAll={revoke}
              />
              {listener}
              <BarIconSwitch />
            </>
          ) : (
            <>
              <IphoneIntro />
              <TestflightBlock link={TESTFLIGHT_LINK} />
              <BarIconSwitch />
            </>
          )}
        </>
      )}
    </PaneShell>
  );
};
