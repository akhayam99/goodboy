import { useCallback, useEffect, useRef, useState } from 'react';

const RESET_MS = 1200;

type CopyParams = {
  readonly text: string;
  readonly key?: string;
};

type UseCopyLinkResult = {
  readonly copiedKey: string | null;
  readonly failedKey: string | null;
  readonly copy: (params: CopyParams) => Promise<void>;
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
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
      setCopiedKey(null);
      setFailedKey(null);
    }, RESET_MS);
  }, []);

  const copy = useCallback(
    async ({ text, key = text }: CopyParams) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setFailedKey(null);
      } catch {
        try {
          fallbackCopy({ value: text });
          setCopiedKey(key);
          setFailedKey(null);
        } catch {
          setCopiedKey(null);
          setFailedKey(key);
        }
      }
      schedule();
    },
    [schedule],
  );

  return { copiedKey, failedKey, copy };
};
