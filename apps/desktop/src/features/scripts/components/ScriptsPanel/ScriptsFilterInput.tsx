import { useRef } from 'react';
import { Kbd, SearchField } from '@goodboy/ui';
import { useSearchKey } from '../../../../shared/hooks/useSearchKey';

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export const ScriptsFilterInput = ({ value, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useSearchKey({ onSearch: () => inputRef.current?.focus() });

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
      hint={<Kbd look="cap">/</Kbd>}
      className="w-52"
    />
  );
};
