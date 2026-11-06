import { useCallback, useEffect, useRef } from 'react';

type Params = {
  readonly onOpen: () => void;
  readonly onRename: () => void;
};

const DOUBLE_CLICK_MS = 220;

export const useTitleClick = ({ onOpen, onRename }: Params) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const onClick = () => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      openRef.current();
    }, DOUBLE_CLICK_MS);
  };

  const onDoubleClick = () => {
    cancel();
    onRename();
  };

  return { onClick, onDoubleClick };
};
