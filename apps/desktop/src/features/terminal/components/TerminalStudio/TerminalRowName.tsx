import { useState, type KeyboardEvent } from 'react';
import { cn, useEscapeLayer } from '@goodboy/ui';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';

type Props = {
  readonly id?: string;
  readonly name: string;
  readonly isSelected: boolean;
  readonly isTab?: boolean;
  readonly onSelect: () => void;
  readonly onRename: (title: string) => Promise<void>;
};

export const TerminalRowName = ({
  id,
  name,
  isSelected,
  isTab = false,
  onSelect,
  onRename,
}: Props) => {
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
          'h-6 min-w-0 flex-1 rounded-sm bg-background px-1 text-meta text-foreground outline-none ring-1 ring-focus-ring',
          hasError && 'ring-danger',
        )}
      />
    );
  }

  return (
    <button
      id={id}
      type="button"
      role={isTab ? 'tab' : undefined}
      aria-selected={isTab ? isSelected : undefined}
      aria-current={isTab ? undefined : isSelected ? 'true' : undefined}
      tabIndex={isTab && !isSelected ? -1 : undefined}
      onClick={onSelect}
      onDoubleClick={() => setDraft(name)}
      onKeyDown={(event) => {
        if (!eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['terminal.renameTab'] })) {
          return;
        }
        event.preventDefault();
        setDraft(name);
      }}
      style={isTab ? { minWidth: 48 } : undefined}
      className="min-w-0 flex-1 truncate text-left text-meta focus-visible:outline-none"
    >
      {name}
    </button>
  );
};
