import { useCallback, useEffect, useRef, useState } from 'react';
import { dropPhoneRules } from '../dropPhoneRules';
import { startPoll } from '../../../../../shared/lib/usePoll/startPoll';
import { CommandError } from '../../../../../shared/lib/invokeCommand';
import {
  bridgeInterfaces,
  bridgePairingDecide,
  bridgePhones,
  bridgeResetPairing,
  bridgeRevoke,
  bridgeRevokePhone,
  bridgeSetInterfaces,
  bridgeSetPermissions,
  bridgeStart,
  bridgeStatus,
  bridgeStop,
  NO_PRIVATE_NETWORK_KIND,
  type BridgeStatus,
  type NetworkInterface,
  type PairedPhone,
  type PhonePermissions,
  type QrInfo,
} from '../../../bridge';

const STATUS_POLL_MS = 3_000;

const PAIRING_CODE_FAILED = "Couldn't make a pairing code.";
const DISCONNECT_FAILED = "Couldn't disconnect the paired devices.";
const NO_NETWORK =
  'No private network is on. Switch one on under Networks, or connect to Wi-Fi or a VPN.';
const CHANGE_FAILED = "Couldn't save that change.";
const RESET_FAILED = "Couldn't reset pairing.";
const DECIDE_FAILED = "Couldn't answer that iPhone.";
type SetPermissionsParams = {
  readonly phoneId: string;
  readonly permissions: PhonePermissions;
};

type RevokeOneParams = {
  readonly phoneId: string;
};

type ToggleParams = {
  readonly name: string;
  readonly isSelected: boolean;
};

type DecidePairingParams = {
  readonly id: string;
  readonly isAllowed: boolean;
};

type MintErrorParams = {
  readonly failure: unknown;
};

const mintErrorOf = ({ failure }: MintErrorParams): string => {
  if (failure instanceof CommandError && failure.kind === NO_PRIVATE_NETWORK_KIND) {
    return NO_NETWORK;
  }
  return PAIRING_CODE_FAILED;
};

type StopFailure = {
  readonly title: string;
  readonly error: unknown;
};

type Params = {
  readonly onStopFailed: (failure: StopFailure) => void;
};

export const useIphonePairing = ({ onStopFailed }: Params) => {
  const [info, setInfo] = useState<QrInfo | null>(null);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [phones, setPhones] = useState<ReadonlyArray<PairedPhone>>([]);
  const [interfaces, setInterfaces] = useState<ReadonlyArray<NetworkInterface>>([]);
  const [isChanging, setIsChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(0);
  const enrolledRef = useRef(0);
  const isMountedRef = useRef(true);
  const pairedAtStartRef = useRef(0);
  const onStopFailedRef = useRef(onStopFailed);
  onStopFailedRef.current = onStopFailed;

  const enrolled = status?.enrolledCount ?? 0;
  enrolledRef.current = enrolled;
  const isPaired = enrolled > 0;
  const isShowingCode = isPairing;
  const total = totalRef.current > 0 ? totalRef.current : 1;

  const refreshStatus = useCallback(async (): Promise<BridgeStatus | null> => {
    try {
      const next = await bridgeStatus();
      if (isMountedRef.current) {
        setStatus(next);
      }
      return next;
    } catch {
      if (isMountedRef.current) {
        setStatus(null);
      }
      return null;
    }
  }, []);

  const refreshPhones = useCallback(async () => {
    try {
      const next = await bridgePhones();
      if (isMountedRef.current) {
        setPhones(Array.isArray(next) ? next : []);
      }
    } catch {
      if (isMountedRef.current) {
        setPhones([]);
      }
    }
  }, []);

  const refreshInterfaces = useCallback(async () => {
    try {
      const next = await bridgeInterfaces();
      if (isMountedRef.current) {
        setInterfaces(Array.isArray(next) ? next : []);
      }
    } catch {
      if (isMountedRef.current) {
        setInterfaces([]);
      }
    }
  }, []);

  const mint = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await bridgeStart();
      if (!isMountedRef.current) {
        return;
      }
      totalRef.current = next.expiresInSecs;
      setRemaining(next.expiresInSecs);
      setInfo(next);
      await refreshStatus();
      await refreshPhones();
    } catch (failure: unknown) {
      if (isMountedRef.current) {
        setError(mintErrorOf({ failure }));
        setInfo(null);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [refreshStatus, refreshPhones]);

  const revoke = useCallback(async () => {
    setIsRevoking(true);
    setError(null);
    try {
      const rules = await bridgeRevoke();
      await dropPhoneRules({ ruleIds: rules });
      setIsPairing(false);
      await refreshStatus();
      await refreshPhones();
    } catch {
      setError(DISCONNECT_FAILED);
    } finally {
      setIsRevoking(false);
    }
  }, [refreshPhones, refreshStatus]);

  const revokeOne = useCallback(
    async ({ phoneId }: RevokeOneParams) => {
      setIsChanging(true);
      setChangeError(null);
      try {
        const rules = await bridgeRevokePhone({ phoneId });
        await dropPhoneRules({ ruleIds: rules });
        await refreshStatus();
        await refreshPhones();
      } catch {
        setChangeError(DISCONNECT_FAILED);
      } finally {
        setIsChanging(false);
      }
    },
    [refreshPhones, refreshStatus],
  );

  const setPermissions = useCallback(
    async ({ phoneId, permissions }: SetPermissionsParams) => {
      setIsChanging(true);
      setChangeError(null);
      try {
        await bridgeSetPermissions({ phoneId, permissions });
      } catch {
        setChangeError(CHANGE_FAILED);
      } finally {
        await refreshPhones();
        setIsChanging(false);
      }
    },
    [refreshPhones],
  );

  const toggleInterface = useCallback(
    async ({ name, isSelected }: ToggleParams) => {
      setIsChanging(true);
      setChangeError(null);
      const chosen = interfaces.filter((net) => net.isSelected).map((net) => net.name);
      const names = isSelected ? [...chosen, name] : chosen.filter((n) => n !== name);
      try {
        await bridgeSetInterfaces({ names });
        await refreshInterfaces();
        if (isPairing) {
          await mint();
        }
      } catch {
        setChangeError(CHANGE_FAILED);
      } finally {
        setIsChanging(false);
      }
    },
    [interfaces, isPairing, mint, refreshInterfaces],
  );

  const decidePairing = useCallback(
    async ({ id, isAllowed }: DecidePairingParams) => {
      setIsChanging(true);
      setChangeError(null);
      try {
        await bridgePairingDecide({ id, isAllowed });
      } catch {
        setChangeError(DECIDE_FAILED);
      } finally {
        await refreshStatus();
        await refreshPhones();
        setIsChanging(false);
      }
    },
    [refreshPhones, refreshStatus],
  );

  const resetPairing = useCallback(async () => {
    setIsChanging(true);
    setChangeError(null);
    try {
      await bridgeResetPairing();
      await refreshStatus();
      await refreshPhones();
      if (isPairing) {
        await mint();
      }
    } catch {
      setChangeError(RESET_FAILED);
    } finally {
      setIsChanging(false);
    }
  }, [isPairing, mint, refreshPhones, refreshStatus]);

  const pair = () => {
    pairedAtStartRef.current = enrolledRef.current;
    setIsPairing(true);
    void mint();
  };

  const cancel = () => {
    setIsPairing(false);
    setError(null);
  };

  useEffect(() => {
    isMountedRef.current = true;
    void refreshInterfaces();
    void refreshStatus();
    void refreshPhones();
    return () => {
      isMountedRef.current = false;
      if (enrolledRef.current === 0) {
        void bridgeStop().catch((error: unknown) =>
          onStopFailedRef.current({ title: "Couldn't stop listening for iPhones", error }),
        );
      }
    };
  }, [refreshInterfaces, refreshStatus, refreshPhones]);

  useEffect(() => {
    if (info === null) {
      return;
    }
    return startPoll({
      run: () => setRemaining((left) => Math.max(0, left - 1)),
      everyMs: 1000,
      gate: 'always',
      isImmediate: false,
    });
  }, [info]);

  useEffect(() => {
    if (isShowingCode && info !== null && remaining === 0 && !isLoading) {
      void mint();
    }
  }, [isShowingCode, remaining, info, isLoading, mint]);

  useEffect(
    () =>
      startPoll({
        run: () => {
          void refreshStatus();
          void refreshPhones();
        },
        everyMs: STATUS_POLL_MS,
        gate: 'visible',
        isImmediate: false,
      }),
    [refreshStatus, refreshPhones],
  );

  useEffect(() => {
    if (isPairing && enrolled > pairedAtStartRef.current) {
      setIsPairing(false);
    }
  }, [enrolled, isPairing]);

  return {
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
  };
};
