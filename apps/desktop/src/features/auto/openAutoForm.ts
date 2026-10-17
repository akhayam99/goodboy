import type { SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
};

export const openAutoForm = ({ sessionId }: Params): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-workflow-builder', {
      detail: { sessionId, form: 'auto' },
    }),
  );
};
