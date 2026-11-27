import { useCallback, useEffect, useRef, useState } from 'react';
import { dropPhoneRules } from '../dropPhoneRules';
import { startPoll } from '../../../../../shared/lib/usePoll/startPoll';
import { useAppStore } from '../../../../../store';
import { useCompanionLinkPoll } from '../../../hooks/useCompanionLinkPoll';
import { CommandError } from '../../../../../shared/lib/invokeCommand';
import {
  bridgeCancelCode,
  bridgeInterfaces,
  bridgePairingDecide,
  bridgeResetPairing,
  bridgeRevoke,
  bridgeRevokePhone,
  bridgeSetInterfaces,
  bridgeSetPermissions,
  bridgeStart,
  bridgeStop,
  NO_PRIVATE_NETWORK_KIND,
  type NetworkInterface,
  type PhonePermissions,
  type QrInfo,
} from '../../../bridge';

const PAIRING_CODE_FAILED = "Couldn't make a pairing code.";
const DISCONNECT_FAILED = "Couldn't disconnect the paired devices.";
const NO_NETWORK =
  'No private network is on. Switch one on under Networks, or connect to Wi-Fi or a VPN.';
const CHANGE_FAILED = "Couldn't save that change.";
const RESET_FAILED = "Couldn't reset pairing.";
const DECIDE_FAILED = "Couldn't answer that iPhone.";
const CANCEL_FAILED = "Couldn't close the pairing code.";
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
  const status = useAppStore((state) => state.companionStatus);
  const phones = useAppStore((state) => state.companionPhones);
  const readMisses = useAppStore((state) => state.companionReadMisses);
  const refresh = useAppStore((state) => state.refreshCompanionLink);
  const setPageOpen = useAppStore((state) => state.setCompanionPageOpen);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [interfaces, setInterfaces] = useState<ReadonlyArray<NetworkInterface>>([]);
  const [isChanging, setIsChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(0);
  const enrolledRef = useRef(0);
  const isMountedRef = useRef(true);
  const pairedAtStartRef = useRef(0);
  const isPairingRef = useRef(false);
  const mintGenerationRef = useRef(0);
  const cancelRef = useRef<Promise<void> | null>(null);
  const hasMintedRef = useRef(false);
  const onStopFailedRef = useRef(onStopFailed);
  onStopFailedRef.current = onStopFailed;

  const enrolled = status?.enrolledCount ?? 0;
  enrolledRef.current = enrolled;
  const isPaired = enrolled > 0;
  const isShowingCode = isPairing;
  const total = totalRef.current > 0 ? totalRef.current : 1;

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
    mintGenerationRef.current += 1;
    const generation = mintGenerationRef.current;
    const isCurrent = () => isMountedRef.current && mintGenerationRef.current === generation;
    setIsLoading(true);
    setError(null);
    try {
      hasMintedRef.current = true;
      await cancelRef.current;
      const next = await bridgeStart();
      if (!isCurrent()) {
        if (isMountedRef.current && !isPairingRef.current) {
          await bridgeCancelCode();
        }
        return;
      }
      if (!isPairingRef.current) {
        await bridgeCancelCode();
        return;
      }
      totalRef.current = next.expiresInSecs;
      setRemaining(next.expiresInSecs);
      setInfo(next);
      await refresh();
    } catch (failure: unknown) {
      if (isCurrent()) {
        setError(mintErrorOf({ failure }));
        setInfo(null);
      }
    } finally {
      if (isCurrent()) {
        setIsLoading(false);
      }
    }
  }, [refresh]);

  const revoke = useCallback(async () => {
    setIsRevoking(true);
    setError(null);
    try {
      const rules = await bridgeRevoke();
      await dropPhoneRules({ ruleIds: rules });
      isPairingRef.current = false;
      setIsPairing(false);
      await refresh();
    } catch {
      setError(DISCONNECT_FAILED);
    } finally {
      setIsRevoking(false);
    }
  }, [refresh]);

  const revokeOne = useCallback(
    async ({ phoneId }: RevokeOneParams) => {
      setIsChanging(true);
      setChangeError(null);
      try {
        const rules = await bridgeRevokePhone({ phoneId });
        await dropPhoneRules({ ruleIds: rules });
        await refresh();
      } catch {
        setChangeError(DISCONNECT_FAILED);
      } finally {
        setIsChanging(false);
      }
    },
    [refresh],
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
        await refresh();
        setIsChanging(false);
      }
    },
    [refresh],
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
        await refresh();
        setIsChanging(false);
      }
    },
    [refresh],
  );

  const resetPairing = useCallback(async () => {
    setIsChanging(true);
    setChangeError(null);
    try {
      await bridgeResetPairing();
      await refresh();
      if (isPairing) {
        await mint();
      }
    } catch {
      setChangeError(RESET_FAILED);
    } finally {
      setIsChanging(false);
    }
  }, [isPairing, mint, refresh]);

  const pair = () => {
    pairedAtStartRef.current = enrolledRef.current;
    isPairingRef.current = true;
    setIsPairing(true);
    void mint();
  };

  const cancel = () => {
    isPairingRef.current = false;
    mintGenerationRef.current += 1;
    setIsPairing(false);
    setIsLoading(false);
    setError(null);
    setInfo(null);
    const closing = bridgeCancelCode()
      .then(() => refresh())
      .then(() => undefined)
      .catch(() => {
        if (isMountedRef.current) {
          setChangeError(CANCEL_FAILED);
        }
      });
    cancelRef.current = closing;
  };

  useEffect(() => {
    isMountedRef.current = true;
    void refreshInterfaces();
    setPageOpen({ isOpen: true });
    return () => {
      isMountedRef.current = false;
      setPageOpen({ isOpen: false });
      if (enrolledRef.current === 0 && hasMintedRef.current) {
        void bridgeStop().catch((error: unknown) =>
          onStopFailedRef.current({ title: "Couldn't stop listening for iPhones", error }),
        );
      }
    };
  }, [refreshInterfaces, setPageOpen]);

  useCompanionLinkPoll({ isOn: true });

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

  useEffect(() => {
    if (isPairing && enrolled > pairedAtStartRef.current) {
      isPairingRef.current = false;
      setIsPairing(false);
    }
  }, [enrolled, isPairing]);

  return {
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
  };
};
