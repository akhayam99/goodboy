import { useEffect, useRef } from 'react';
import { useAppStore } from '../../../../store';
import type { DevicePresetId } from '../../../../store/slices/browser/types';
import { currentPlatform } from '../../../../shared/platform';
import { browserHost } from '../../browserHost';
import {
  DEFAULT_DEVICE_PRESET,
  DEVICE_WIDTH_ONLY_NOTE,
  DEVICE_WIDTH_PLATFORM_NOTE,
  deviceNoteOf,
} from '../../devicePresets';

type NoteParams = {
  readonly note: string | null;
};

type ErrorParams = {
  readonly error: string;
};

type Params = {
  readonly tabId: string | null;
  readonly liveId: string | undefined;
  readonly title: string;
  readonly onNote: (params: NoteParams) => void;
  readonly onError: (params: ErrorParams) => void;
};

type ChangeParams = {
  readonly preset: DevicePresetId;
};

type SyncParams = {
  readonly tabId: string;
  readonly liveId: string;
};

type TabParams = {
  readonly tabId: string;
};

type Result = {
  readonly preset: DevicePresetId;
  readonly change: (params: ChangeParams) => void;
};

const presetOf = ({ tabId }: TabParams): DevicePresetId =>
  useAppStore.getState().browserDevicePresets[tabId] ?? DEFAULT_DEVICE_PRESET;

export const useDeviceAgent = ({ tabId, liveId, title, onNote, onError }: Params): Result => {
  const preset = useAppStore((state) =>
    tabId === null
      ? DEFAULT_DEVICE_PRESET
      : (state.browserDevicePresets[tabId] ?? DEFAULT_DEVICE_PRESET),
  );
  const appliedRef = useRef(new Map<string, DevicePresetId>());
  const busyRef = useRef(new Set<string>());
  const titleRef = useRef(title);
  titleRef.current = title;
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (tabId === null || liveId === undefined || currentPlatform() !== 'darwin') {
      return;
    }
    if ((appliedRef.current.get(liveId) ?? DEFAULT_DEVICE_PRESET) === preset) {
      return;
    }
    const sync = async ({ tabId: savedId, liveId: hostId }: SyncParams): Promise<void> => {
      if (busyRef.current.has(hostId)) {
        return;
      }
      busyRef.current.add(hostId);
      try {
        let wanted = presetOf({ tabId: savedId });
        while ((appliedRef.current.get(hostId) ?? DEFAULT_DEVICE_PRESET) !== wanted) {
          await browserHost.userAgent({ tabId: hostId, preset: wanted });
          appliedRef.current.set(hostId, wanted);
          wanted = presetOf({ tabId: savedId });
        }
      } catch {
        onNoteRef.current({ note: DEVICE_WIDTH_ONLY_NOTE });
        onErrorRef.current({ error: `Couldn't change the user agent of ${titleRef.current}` });
      } finally {
        busyRef.current.delete(hostId);
      }
    };
    void sync({ tabId, liveId });
  }, [tabId, liveId, preset]);

  return {
    preset,
    change: ({ preset: next }) => {
      if (tabId === null) {
        return;
      }
      useAppStore.getState().setBrowserDevicePreset({ tabId, preset: next });
      const isPlatformLimited = next !== 'desktop' && currentPlatform() !== 'darwin';
      onNoteRef.current({
        note: isPlatformLimited ? DEVICE_WIDTH_PLATFORM_NOTE : deviceNoteOf({ id: next }),
      });
    },
  };
};
