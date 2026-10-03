import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Reveal } from '@goodboy/ui';

type Props = {
  readonly groupId: string;
  readonly isLeaving: boolean;
  readonly isShown?: boolean;
  readonly onSettled: (params: { readonly id: string }) => void;
  readonly children: ReactNode;
};

export const TimelineRevealRow = ({
  groupId,
  isLeaving,
  isShown = false,
  onSettled,
  children,
}: Props) => {
  const [isMounted, setMounted] = useState(isShown);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      data-reveal-group={groupId}
      data-leaving={isLeaving ? 'true' : undefined}
      inert={isLeaving}
      aria-hidden={isLeaving ? true : undefined}
    >
      <Reveal open={isMounted && !isLeaving} onClosed={() => onSettled({ id: groupId })}>
        {children}
      </Reveal>
    </div>
  );
};
