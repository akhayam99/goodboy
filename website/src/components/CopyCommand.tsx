import { useEffect, useRef, useState } from 'react';

type Props = {
  readonly command: string;
};

const COPIED_MS = 1500;

export const CopyCommand = ({ command }: Props) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const handleCopy = () => {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      return;
    }
    navigator.clipboard
      .writeText(command)
      .then(() => {
        setIsCopied(true);
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_MS);
      })
      .catch(() => setIsCopied(false));
  };

  return (
    <div className="cmd" data-download>
      <span className="cmdPrompt" aria-hidden="true">
        $
      </span>
      <code>{command}</code>
      <button type="button" onClick={handleCopy}>
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
};
