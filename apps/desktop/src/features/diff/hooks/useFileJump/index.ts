import { useMemo, useState, type KeyboardEvent } from 'react';
import type { FileDiff } from '@goodboy/types';

type Match = {
  readonly file: FileDiff;
  readonly score: number;
};

const subsequenceScore = (haystack: string, needle: string): number | null => {
  let from = 0;
  let gaps = 0;
  for (const char of needle) {
    const at = haystack.indexOf(char, from);
    if (at < 0) {
      return null;
    }
    gaps += at - from;
    from = at + 1;
  }
  return gaps;
};

export const filterFiles = (
  files: ReadonlyArray<FileDiff>,
  query: string,
): ReadonlyArray<FileDiff> => {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return files;
  }
  const matches: Match[] = [];
  for (const file of files) {
    const path = file.path.toLowerCase();
    const name = path.slice(path.lastIndexOf('/') + 1);
    const nameScore = subsequenceScore(name, needle);
    if (nameScore !== null) {
      matches.push({ file, score: nameScore });
      continue;
    }
    const pathScore = subsequenceScore(path, needle);
    if (pathScore !== null) {
      matches.push({ file, score: 1000 + pathScore });
    }
  }
  return matches.sort((a, b) => a.score - b.score).map((match) => match.file);
};

type Params = {
  readonly files: ReadonlyArray<FileDiff>;
  readonly onPick: (path: string) => void;
};

export type FileJump = {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly results: ReadonlyArray<FileDiff>;
  readonly activeIndex: number;
  readonly setActiveIndex: (index: number) => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
};

export const useFileJump = ({ files, onPick }: Params): FileJump => {
  const [query, setQueryState] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => filterFiles(files, query), [files, query]);
  const clampedIndex = Math.min(activeIndex, Math.max(0, results.length - 1));

  const setQuery = (next: string) => {
    setQueryState(next);
    setActiveIndex(0);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(Math.min(clampedIndex + 1, results.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(Math.max(clampedIndex - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      const picked = results[clampedIndex];
      if (picked) {
        event.preventDefault();
        onPick(picked.path);
      }
    }
  };

  return { query, setQuery, results, activeIndex: clampedIndex, setActiveIndex, onKeyDown };
};
