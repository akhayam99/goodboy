import { useEffect, useState } from 'react';
import { NEEDS_YOU_FEEDBACK_EVENT } from '../../../features/workspace/components/SessionSwitcher/needsYouFeedbackEvent';

const SHOWN_MS = 2_000;

type DetailParams = {
  readonly value: unknown;
};

const textOf = ({ value }: DetailParams): string | null =>
  typeof value === 'object' && value !== null && 'text' in value && typeof value.text === 'string'
    ? value.text
    : null;

export const NeedsYouFeedback = () => {
  const [text, setText] = useState('');

  useEffect(() => {
    const listener = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    window.addEventListener(
      NEEDS_YOU_FEEDBACK_EVENT,
      (event) => {
        const next = event instanceof CustomEvent ? textOf({ value: event.detail }) : null;
        if (next === null) {
          return;
        }
        clearTimeout(timer);
        setText(next);
        timer = setTimeout(() => setText(''), SHOWN_MS);
      },
      { signal: listener.signal },
    );
    return () => {
      listener.abort();
      clearTimeout(timer);
    };
  }, []);

  return (
    <span
      role="status"
      aria-live="polite"
      data-needs-you-feedback=""
      className="truncate text-meta text-muted-foreground empty:hidden"
    >
      {text}
    </span>
  );
};
