import { useEffect, useRef } from 'react';
import { PROJECT_DETACH_EVENT } from '../../../../../actions/kinds/project';

type Params = {
  readonly projectKey: string;
  readonly canTake: boolean;
  readonly onRequest: () => void;
};

export const useProjectDetachRequest = ({ projectKey, canTake, onRequest }: Params): void => {
  const canTakeRef = useRef(canTake);
  canTakeRef.current = canTake;
  const onRequestRef = useRef(onRequest);
  onRequestRef.current = onRequest;

  useEffect(() => {
    const controller = new AbortController();
    window.addEventListener(
      PROJECT_DETACH_EVENT,
      (event) => {
        const detail: unknown = event instanceof CustomEvent ? event.detail : null;
        const isMine =
          typeof detail === 'object' &&
          detail !== null &&
          'projectKey' in detail &&
          detail.projectKey === projectKey;
        if (!isMine || !canTakeRef.current) {
          return;
        }
        event.stopImmediatePropagation();
        onRequestRef.current();
      },
      { signal: controller.signal },
    );
    return () => controller.abort();
  }, [projectKey]);
};
