import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { shortcutGlyphs } from '../../keyboard/registry';
import { terminalFindKey } from './terminalFindKey';

export type TerminalFindResults = {
  readonly index: number;
  readonly count: number;
};

export type TerminalFindController = {
  readonly findNext: (term: string) => void;
  readonly findPrevious: (term: string) => void;
  readonly clear: () => void;
  readonly onResults: (listener: (results: TerminalFindResults) => void) => () => void;
};

type SummaryParams = {
  readonly term: string;
  readonly results: TerminalFindResults | null;
};

const findSummary = ({ term, results }: SummaryParams): string => {
  if (term.length === 0 || results === null) {
    return '';
  }
  if (results.count === 0) {
    return 'No match';
  }
  if (results.index < 0) {
    return `${results.count} matches`;
  }
  return `${results.index + 1} of ${results.count}`;
};

type WalkParams = {
  readonly isForward: boolean;
};

type Props = {
  readonly controller: TerminalFindController;
  readonly step: number;
  readonly onClose: () => void;
};

export const TerminalFindBar = ({ controller, step, onClose }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<TerminalFindResults | null>(null);

  useEffect(() => controller.onResults(setResults), [controller]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [step]);

  useEffect(() => {
    if (term.length === 0) {
      controller.clear();
      setResults(null);
      return;
    }
    controller.findNext(term);
  }, [controller, term]);

  useEffect(() => () => controller.clear(), [controller]);

  const walk = ({ isForward }: WalkParams) => {
    if (term.length === 0) {
      return;
    }
    if (isForward) {
      controller.findNext(term);
      return;
    }
    controller.findPrevious(term);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const key = terminalFindKey({ event: event.nativeEvent, isOpen: true });
    if (key === 'next' || key === 'previous') {
      event.preventDefault();
      event.stopPropagation();
      walk({ isForward: key === 'next' });
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      walk({ isForward: !event.shiftKey });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  const summary = findSummary({ term, results });

  return (
    <div
      role="search"
      aria-label="Find in terminal"
      className="absolute right-2 top-2 z-10 flex items-center gap-2 rounded-lg border border-border bg-floating py-1 pl-2 pr-1 shadow-lg"
    >
      <input
        ref={inputRef}
        type="text"
        value={term}
        placeholder="Find in scrollback"
        aria-label="Find in terminal"
        spellCheck={false}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-44 bg-transparent text-label text-foreground placeholder:text-faint-foreground focus-visible:outline-none"
      />
      <span role="status" className="min-w-14 text-meta text-faint-foreground">
        {summary}
      </span>
      <IconButton
        icon={ChevronUp}
        label="Previous match"
        tooltip={`Previous match (${shortcutGlyphs('find.previous')})`}
        variant="ghost"
        disabled={term.length === 0}
        onClick={() => walk({ isForward: false })}
      />
      <IconButton
        icon={ChevronDown}
        label="Next match"
        tooltip={`Next match (${shortcutGlyphs('find.next')})`}
        variant="ghost"
        disabled={term.length === 0}
        onClick={() => walk({ isForward: true })}
      />
      <IconButton icon={X} label="Close find" variant="ghost" onClick={onClose} />
    </div>
  );
};
