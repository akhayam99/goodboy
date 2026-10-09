import { useEffect, useRef } from 'react';
import { KbdPill, SearchField } from '@goodboy/ui';
import { isTypingTarget } from '../../../../shared/keyboard/isTypingTarget';

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
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
    <SearchField
      inputRef={inputRef}
      value={value}
      onChange={onChange}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || value === '') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onChange('');
      }}
      ariaLabel="Filter scripts"
      placeholder="Filter scripts"
      hint={<KbdPill>/</KbdPill>}
      className="w-52"
    />
  );
};
