import { useShallow } from 'zustand/react/shallow';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectCheckChain } from '../../../../store/slices/agents/selectCheckChain';
import { checkTargetOf } from '../../checks/checkTargetOf';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

export type AnalyzedCheck = {
  readonly url: string;
  readonly name: string | null;
  readonly isPushed: boolean;
};

export const useAnalyzedCheck = ({ sessionId, mountId }: Params): AnalyzedCheck | null =>
  useAppStore(
    useShallow((state) => {
      const target =
        mountId === null
          ? null
          : checkTargetOf({ state, sessionId, mountId, failingUrl: null, failingName: null });
      return target === null
        ? null
        : {
            ...target,
            isPushed:
              selectCheckChain({ state, sessionId, url: target.url }).state === 'fixed-pushed',
          };
    }),
  );
