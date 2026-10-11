import { useState, type KeyboardEvent } from 'react';
import { cn, useEscapeLayer } from '@goodboy/ui';

type Props = {
  readonly name: string;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onRename: (title: string) => Promise<void>;
};

export const TerminalRowName = ({ name, isSelected, onSelect, onRename }: Props) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const save = async (): Promise<void> => {
    if (draft === null) {
      return;
    }
    try {
      await onRename(draft);
      setHasError(false);
      setDraft(null);
    } catch {
      setHasError(true);
    }
  };

  const cancel = (): void => {
    setHasError(false);
    setDraft(null);
  };

  useEscapeLayer(cancel, draft !== null);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void save();
    }
  };

  if (draft !== null) {
    return (
      <input
        autoFocus
        aria-label={`Rename ${name}`}
        aria-invalid={hasError}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={cancel}
        className={cn(
          'h-6 min-w-0 flex-1 rounded-sm bg-background px-1 text-label text-foreground outline-none ring-1 ring-focus-ring',
          hasError && 'ring-danger',
        )}
      />
    );
  }

  return (
    <button
      type="button"
      aria-current={isSelected ? 'true' : undefined}
      onClick={onSelect}
      onDoubleClick={() => setDraft(name)}
      className="min-w-0 flex-1 truncate text-left text-label focus-visible:outline-none"
    >
      {name}
    </button>
  );
};
