import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { KbdPill } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

export const ScriptsFilterInput = ({ value, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-7 w-52 items-center gap-1.5 rounded-md border border-border-soft bg-subtle px-2 focus-within:ring-2 focus-within:ring-focus-ring">
      <Search size={ICON_SIZE.row} className="shrink-0 text-muted-foreground" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        aria-label="Filter scripts"
        placeholder="Filter scripts"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || value === '') {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onChange('');
        }}
        className="min-w-0 flex-1 bg-transparent text-label text-foreground outline-none placeholder:text-muted-foreground"
      />
      {value === '' ? <KbdPill>/</KbdPill> : null}
    </div>
  );
};
