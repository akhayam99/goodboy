import { useEffect, type RefObject } from 'react';
import type { AgentId } from '@goodboy/types';
import { focusComposerTextarea } from '../../focusComposerTextarea';

type Params = {
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
  readonly selectedAgentId: AgentId | null;
  readonly shouldFocusFirstMessage: boolean;
};

export const useFirstMessageFocus = ({
  wrapperRef,
  selectedAgentId,
  shouldFocusFirstMessage,
}: Params) => {
  useEffect(() => {
    if (selectedAgentId == null || !shouldFocusFirstMessage) {
      return;
    }
    focusComposerTextarea(wrapperRef);
  }, [wrapperRef, selectedAgentId, shouldFocusFirstMessage]);
};
