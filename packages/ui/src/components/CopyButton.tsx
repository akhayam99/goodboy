import { useState } from 'react';
import { Button } from './Button';

export type CopyButtonProps = {
  value: string;
  label?: string;
};

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export const CopyButton = ({ value, label = 'text' }: CopyButtonProps) => {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      try {
        fallbackCopy(value);
        setState('copied');
      } catch {
        setState('error');
      }
    }
    window.setTimeout(() => setState('idle'), 1200);
  };

  const buttonText = (() => {
    if (state === 'copied') return `copied: ${label}`;
    if (state === 'error') return 'copy failed';
    return 'copy';
  })();

  return (
    <Button variant="ghost" size="sm" onClick={() => void onCopy()} aria-label={`copy ${label}`}>
      {buttonText}
    </Button>
  );
};
