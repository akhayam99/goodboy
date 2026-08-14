import { useCallback, useEffect, useRef, useState } from 'react';

const RESET_MS = 1200;

type UseCopyLinkResult = {
  readonly copied: boolean;
  readonly failed: boolean;
  readonly copy: (value: string) => Promise<void>;
};

const fallbackCopy = ({ value }: { readonly value: string }) => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

export const useCopyLink = (): UseCopyLinkResult => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const schedule = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
    }
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
        try {
          fallbackCopy({ value });
          setCopied(true);
          setFailed(false);
        } catch {
          setCopied(false);
          setFailed(true);
        }
      }
      schedule();
    },
    [schedule],
  );

  return { copied, failed, copy };
};
