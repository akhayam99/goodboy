import { useEffect, useRef, type MouseEvent } from 'react';
import type { SessionId } from '@goodboy/types';

export type CardHover = {
  readonly sessionId: SessionId;
  readonly anchor: HTMLElement;
};

type Params = {
  readonly sessionId: SessionId;
  readonly onHoverEnter?: (target: CardHover) => void;
  readonly onHoverLeave?: () => void;
};

type EnterParams = Pick<CardHover, 'anchor'>;

export type CardHoverHandlers = {
  readonly enterCard: (params: EnterParams) => void;
  readonly leaveCard: () => void;
  readonly resumeCard: (event: MouseEvent<HTMLElement>) => void;
};

export const useCardHover = ({
  sessionId,
  onHoverEnter,
  onHoverLeave,
}: Params): CardHoverHandlers => {
  const isEnteredRef = useRef(false);
  const leaveRef = useRef(onHoverLeave);
  leaveRef.current = onHoverLeave;
  useEffect(
    () => () => {
      if (isEnteredRef.current) {
        isEnteredRef.current = false;
        leaveRef.current?.();
      }
    },
    [],
  );

  const enterCard = ({ anchor }: EnterParams) => {
    isEnteredRef.current = true;
    onHoverEnter?.({ sessionId, anchor });
  };

  const leaveCard = () => {
    isEnteredRef.current = false;
    onHoverLeave?.();
  };

  const resumeCard = ({ currentTarget }: MouseEvent<HTMLElement>) => {
    enterCard({ anchor: currentTarget.closest('article') ?? currentTarget });
  };

  return { enterCard, leaveCard, resumeCard };
};
