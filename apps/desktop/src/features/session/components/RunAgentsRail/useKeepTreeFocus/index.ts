import { useCallback, useEffect, useRef } from 'react';
import type { AgentId } from '@goodboy/types';

type Params = {
  readonly host: HTMLElement | null;
  readonly shownAgentId: AgentId;
};

const TREE_SELECTOR = '[role="tree"]';

export const useKeepTreeFocus = ({ host, shownAgentId }: Params): (() => void) => {
  const isPending = useRef(false);
  useEffect(() => {
    if (!isPending.current || host === null) {
      return;
    }
    isPending.current = false;
    const frame = requestAnimationFrame(() => {
      host.querySelector<HTMLElement>(TREE_SELECTOR)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [host, shownAgentId]);
  return useCallback(() => {
    const active = document.activeElement;
    isPending.current =
      host !== null && active !== null && host.contains(active) && active.matches(':focus-visible');
  }, [host]);
};
