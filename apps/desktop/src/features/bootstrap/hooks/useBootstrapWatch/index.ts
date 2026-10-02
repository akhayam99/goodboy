import { useEffect } from 'react';
import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const POLL_MS = 60_000;
const SLOW_POLL_MS = 300_000;
const FOCUS_DEBOUNCE_MS = 400;
const SLOW_AFTER_UNREACHABLE = 3;

type Params = {
  readonly projectId: ProjectId | null;
  readonly enabled: boolean;
};

export const useBootstrapWatch = ({ projectId, enabled }: Params): void => {
  const probeProjectRemote = useAppStore((state) => state.probeProjectRemote);
  const isMainPresent = useAppStore(
    (state) =>
      projectId !== null && state.bootstrapRemoteProbe[projectId]?.probe.kind === 'main-present',
  );
  const isWatching = enabled && projectId !== null && !isMainPresent;

  useEffect(() => {
    if (!isWatching || projectId === null) {
      return;
    }
    let stopped = false;
    let unreachable = 0;
    let idle = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const delay = (): number =>
      unreachable >= SLOW_AFTER_UNREACHABLE || idle ? SLOW_POLL_MS : POLL_MS;

    const check = async (): Promise<void> => {
      const probe = await probeProjectRemote({ projectId });
      if (stopped) {
        return;
      }
      unreachable = probe.kind === 'unreachable' ? unreachable + 1 : 0;
      idle = probe.kind === 'no-remote';
    };

    const schedule = (): void => {
      timer = setTimeout(() => {
        if (document.visibilityState !== 'visible') {
          schedule();
          return;
        }
        void check().finally(() => {
          if (!stopped) {
            schedule();
          }
        });
      }, delay());
    };

    const onFocus = (): void => {
      if (focusTimer !== null) {
        clearTimeout(focusTimer);
      }
      focusTimer = setTimeout(() => {
        void check();
      }, FOCUS_DEBOUNCE_MS);
    };

    void check().finally(() => {
      if (!stopped) {
        schedule();
      }
    });
    window.addEventListener('focus', onFocus);
    return () => {
      stopped = true;
      window.removeEventListener('focus', onFocus);
      if (timer !== null) {
        clearTimeout(timer);
      }
      if (focusTimer !== null) {
        clearTimeout(focusTimer);
      }
    };
  }, [isWatching, projectId, probeProjectRemote]);
};
