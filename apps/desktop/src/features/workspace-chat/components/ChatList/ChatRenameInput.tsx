import { useEffect, useRef, type KeyboardEvent } from 'react';

type Props = {
  readonly title: string;
  readonly onCommit: (title: string) => void;
  readonly onCancel: () => void;
};

export const ChatRenameInput = ({ title, onCommit, onCancel }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDone = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (save: boolean): void => {
    if (isDone.current) {
      return;
    }
    isDone.current = true;
    if (save) {
      onCommit(inputRef.current?.value ?? title);
      return;
    }
    onCancel();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={title}
      aria-label="Rename chat"
      spellCheck={false}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
      className="pointer-events-auto -ml-2 h-6 min-w-0 flex-1 rounded-sm bg-floating px-2 text-label text-foreground outline-none ring-1 ring-focus-ring"
    />
  );
};
