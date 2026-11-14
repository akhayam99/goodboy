import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import type { ContextDrawerSection } from '../../../../../store/slices/drawer/state';
import { CONTEXT_SECTION_SLOT } from '../contextSectionSlots';

type Params = {
  readonly sessionId: SessionId;
};

type WriteParams = {
  readonly section: Exclude<ContextDrawerSection, 'explanations'>;
  readonly next: string;
};

export const useWriteContextSlot = ({ sessionId }: Params) => {
  const reportError = useAppStore((state) => state.reportError);
  const upsertSessionSlot = useAppStore((state) => state.upsertSessionSlot);
  return async ({ section, next }: WriteParams): Promise<boolean> => {
    try {
      await upsertSessionSlot(sessionId, CONTEXT_SECTION_SLOT[section], next);
      return true;
    } catch (error: unknown) {
      void reportError({
        recovery: CHECK_STATE,
        title: "Couldn't save the context",
        error,
        sessionId,
      });
      return false;
    }
  };
};
