import { useState } from 'react';
import { Button } from '@kay-am/ui';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard API not available
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={onCopy} aria-label="copy">
      {copied ? 'copied' : 'copy'}
    </Button>
  );
}
