import type { KeyboardEvent, Ref } from 'react';
import { SearchField, useEscapeLayer } from '@goodboy/ui';

export type RailSearchStep = 'next' | 'previous';

type Props = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onSubmit?: () => void;
  readonly onStep?: (step: RailSearchStep) => void;
  readonly inputRef?: Ref<HTMLInputElement>;
};

type StepParams = {
  readonly key: string;
};

const stepOf = ({ key }: StepParams): RailSearchStep | null => {
  if (key === 'ArrowDown') {
    return 'next';
  }
  return key === 'ArrowUp' ? 'previous' : null;
};

export const RailSearch = ({ label, value, onChange, onSubmit, onStep, inputRef }: Props) => {
  const isSearching = value !== '';
  useEscapeLayer(() => onChange(''), isSearching);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && onSubmit !== undefined && value.trim() !== '') {
      event.preventDefault();
      onSubmit();
      return;
    }
    const step = stepOf({ key: event.key });
    if (step === null || onStep === undefined || !isSearching) {
      return;
    }
    event.preventDefault();
    onStep(step);
  };

  return (
    <SearchField
      inputRef={inputRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={label}
      ariaLabel={label}
      autoComplete="off"
      spellCheck={false}
      data-rail-search=""
      className="shrink-0"
    />
  );
};
