import { useCallback, useEffect, useRef, useState } from 'react';

const RESET_MS = 1200;

type UseCopyLinkResult = {
  readonly copied: boolean;
  readonly failed: boolean;
  readonly copy: (value: string) => Promise<void>;
};

export const useCopyLink = (): UseCopyLinkResult => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, RESET_MS);
  }, []);

  const copy = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setFailed(false);
      } catch {
        setCopied(false);
        setFailed(true);
      }
      schedule();
    },
    [schedule],
  );

  return { copied, failed, copy };
};
