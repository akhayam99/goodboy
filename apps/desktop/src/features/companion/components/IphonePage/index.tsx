import { Button, Notice, PaneShell } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { NAMES } from '../../../../shared/utils/names';
import type { BridgeStatus } from '../../bridge';
import { IphoneEmpty } from './IphoneEmpty';
import { ListenerSection } from './ListenerSection';
import { PairedDevices } from './PairedDevices';
import { PairingFault } from './PairingFault';
import { PairingPanel } from './PairingPanel';
import { PairingRequest } from './PairingRequest';
import { TopBarSection } from './TopBarSection';
import { useIphonePairing } from './useIphonePairing';

const READ_MISSES_SHOWN = 2;
const READ_FAILED = "Couldn't refresh the iPhone link. Showing the last state.";
const FIRST_READ_FAILED = "Couldn't read the iPhone link.";

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
    readMisses,
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
  const now = useNow(30_000, true);

  const fault = status?.fault ?? null;
  const pending = status?.pendingPairing ?? null;
  const isKnown = status !== null;
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
      {isKnown && readMisses >= READ_MISSES_SHOWN ? (
        <Notice tone="warning" placement="inline" title={READ_FAILED} />
      ) : null}
      {!isKnown && readMisses > 0 ? (
        <Notice tone="danger" placement="inline" title={FIRST_READ_FAILED} />
      ) : null}
    </>
  );
  const listener = (
    <ListenerSection
      status={status}
      interfaces={interfaces}
      isFaulted={fault !== null}
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
          {isKnown && isPaired ? (
            <>
              <PairedDevices
                enrolled={enrolled}
                phones={phones}
                now={now}
                isFaulted={fault !== null}
                isBusy={isRevoking || isChanging}
                onSetPermissions={setPermissions}
                onRevokeOne={revokeOne}
                onRevokeAll={revoke}
              />
              {listener}
              <TopBarSection />
            </>
          ) : null}
          {isKnown && !isPaired ? (
            <>
              <IphoneEmpty />
              <TopBarSection />
            </>
          ) : null}
        </>
      )}
    </PaneShell>
  );
};
