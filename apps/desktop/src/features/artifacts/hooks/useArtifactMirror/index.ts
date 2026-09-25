import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { isMainWindow } from '../../../workspace/window';
import { artifactMirrorItems } from '../../artifactMirror/artifactMirrorItems';
import { mirrorArtifacts } from '../../artifactMirror/artifactMirrorQueue';
import { backfillArtifactMirrors } from '../../artifactMirror/backfillArtifactMirrors';

export const useArtifactMirror = ({ isReady }: { readonly isReady: boolean }): void => {
  useEffect(() => {
    if (!isReady) {
      return;
    }
    const state = useAppStore.getState();
    void mirrorArtifacts({ items: artifactMirrorItems({ state }) });
    return useAppStore.subscribe((next, previous) => {
      if (next.sessionArtifacts === previous.sessionArtifacts) {
        return;
      }
      void mirrorArtifacts({ items: artifactMirrorItems({ state: next }) });
    });
  }, [isReady]);

  useEffect(() => {
    if (!isReady || !isMainWindow()) {
      return;
    }
    const controller = new AbortController();
    backfillArtifactMirrors({ signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [isReady]);
};
