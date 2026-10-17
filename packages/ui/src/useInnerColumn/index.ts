import { useEffect, useRef } from 'react';
import { innerColumnStore, type InnerColumn } from '../innerColumnStore';

type Params = InnerColumn & {
  readonly isActive: boolean;
};

export const useInnerColumn = ({ id, label, toggle, isActive }: Params): void => {
  const toggleRef = useRef(toggle);
  const labelRef = useRef(label);
  const keyRef = useRef<number | null>(null);
  toggleRef.current = toggle;
  labelRef.current = label;

  useEffect(() => {
    if (!isActive) {
      return;
    }
    const key = innerColumnStore.add({
      column: { id, label: labelRef.current, toggle: () => toggleRef.current() },
    });
    keyRef.current = key;
    return () => {
      keyRef.current = null;
      innerColumnStore.remove({ key });
    };
  }, [id, isActive]);

  useEffect(() => {
    const key = keyRef.current;
    if (key === null) {
      return;
    }
    innerColumnStore.rename({ key, label });
  }, [label]);
};
