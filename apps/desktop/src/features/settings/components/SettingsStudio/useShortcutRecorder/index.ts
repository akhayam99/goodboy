import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { currentPlatform } from '../../../../../shared/platform';
import { eventMatches } from '../../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../../shared/keyboard/registry';
import { entryById } from '../../../../../shared/keyboard/overrides/entryById';
import { comboFromEvent } from '../../../../../shared/keyboard/overrides/comboFromEvent';
import { findComboConflict } from '../../../../../shared/keyboard/overrides/findComboConflict';
import { normalizeCombo } from '../../../../../shared/keyboard/overrides/normalizeCombo';
import { recorderMessage } from '../recorderMessage';
import { shortcutOverrideSave } from '../shortcutOverrideSave';
import { NOTHING_CHANGED } from '../../../../../store/slices/notifications/errorRecovery';

type Params = {
  readonly overrides: Readonly<Record<string, string>>;
};

type IdParams = {
  readonly id: string;
};

type CommitParams = {
  readonly id: string;
  readonly combo: string | null;
};

export type ShortcutRecorder = {
  readonly recordingId: string | null;
  readonly message: string | null;
  readonly isSaving: boolean;
  readonly begin: (params: IdParams) => void;
  readonly cancel: () => void;
  readonly reset: (params: IdParams) => Promise<void>;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const UNSUPPORTED = 'That key cannot be used here. Press other keys, or Esc to cancel.';

export const useShortcutRecorder = ({ overrides }: Params): ShortcutRecorder => {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const reportError = useAppStore((state) => state.reportError);

  const cancel = useCallback((): void => {
    setRecordingId(null);
    setMessage(null);
  }, []);

  useEscapeLayer(cancel, recordingId !== null);

  const begin = useCallback(({ id }: IdParams): void => {
    setRecordingId(id);
    setMessage(null);
  }, []);

  const commit = useCallback(
    async ({ id, combo }: CommitParams): Promise<void> => {
      if (isSavingRef.current) {
        return;
      }
      isSavingRef.current = true;
      setIsSaving(true);
      try {
        await shortcutOverrideSave({ id, combo });
        setRecordingId((current) => (current === id ? null : current));
        setMessage(null);
      } catch (error) {
        void reportError({ title: "Couldn't save the shortcut", error, recovery: NOTHING_CHANGED });
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [reportError],
  );

  const reset = useCallback(({ id }: IdParams) => commit({ id, combo: null }), [commit]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      const native = event.nativeEvent;
      if (
        recordingId === null ||
        isSavingRef.current ||
        eventMatches({ event: native, entry: SHORTCUTS['overlay.close'] })
      ) {
        return;
      }
      event.preventDefault();
      native.stopPropagation();
      const recorded = comboFromEvent({ event: native, isMac: currentPlatform() === 'darwin' });
      if (recorded.kind === 'waiting') {
        return;
      }
      if (recorded.kind === 'unsupported') {
        setMessage(UNSUPPORTED);
        return;
      }
      const combo = normalizeCombo({ combo: recorded.combo });
      const current = entryById.get(recordingId);
      if (current !== undefined && combo === normalizeCombo({ combo: current.combo })) {
        void commit({ id: recordingId, combo: null });
        return;
      }
      const conflict = findComboConflict({
        id: recordingId,
        combo,
        overrides: overridesRef.current,
      });
      if (conflict !== null) {
        setMessage(recorderMessage({ combo, conflict }));
        return;
      }
      void commit({ id: recordingId, combo });
    },
    [recordingId, commit],
  );

  return { recordingId, message, isSaving, begin, cancel, reset, onKeyDown };
};
