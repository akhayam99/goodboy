import { useState } from 'react';
import { Button } from './Button';

export interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'text' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Previously this component fell back to `document.execCommand('copy')`
  // via a synthetic textarea when the async clipboard API was unavailable.
  // execCommand is deprecated and the host environment (Tauri 2 / Chromium
  // 130+) always exposes navigator.clipboard, so the fallback was dead
  // surface that mutated the DOM for no real benefit.
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('error');
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
}
