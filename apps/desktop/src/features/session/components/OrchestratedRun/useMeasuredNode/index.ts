import { useCallback, useEffect, useState } from 'react';

type NodeParams = {
  readonly node: HTMLElement;
};

type Params<Value> = {
  readonly measure: (params: NodeParams) => Value;
  readonly initial: Value;
};

type Measured<Value> = {
  readonly ref: (node: HTMLElement | null) => void;
  readonly value: Value;
};

export const useMeasuredNode = <Value>({ measure, initial }: Params<Value>): Measured<Value> => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [value, setValue] = useState<Value>(initial);
  const ref = useCallback((next: HTMLElement | null) => setNode(next), []);

  useEffect(() => {
    if (node === null) {
      return;
    }
    const read = () => setValue(measure({ node }));
    read();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, measure]);

  return { ref, value };
};
