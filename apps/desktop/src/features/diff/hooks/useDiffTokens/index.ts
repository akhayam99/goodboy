import { useEffect, useMemo, useState } from 'react';
import type { DiffHunk, DiffHunkLine } from '@goodboy/types';
import {
  highlightCode,
  languageForPath,
  type SyntaxLang,
  type SyntaxToken,
} from '../../lib/highlight';

export type DiffTokenMap = ReadonlyMap<string, ReadonlyArray<SyntaxToken>>;

type Stream = {
  keys: ReadonlyArray<string>;
  code: string;
};

const lineKey = (line: DiffHunkLine): string | null => {
  if (line.kind === 'del') {
    return line.oldLine === null ? null : `o${line.oldLine}`;
  }
  return line.newLine === null ? null : `n${line.newLine}`;
};

export const tokensForLine = (
  map: DiffTokenMap | null,
  line: DiffHunkLine,
): ReadonlyArray<SyntaxToken> | null => {
  if (map === null) {
    return null;
  }
  const key = lineKey(line);
  return key === null ? null : (map.get(key) ?? null);
};

export const buildDiffStreams = (hunks: ReadonlyArray<DiffHunk>): ReadonlyArray<Stream> => {
  const streams: Stream[] = [];
  for (const hunk of hunks) {
    const oldKeys: string[] = [];
    const oldText: string[] = [];
    const newKeys: string[] = [];
    const newText: string[] = [];
    for (const line of hunk.lines) {
      if (line.kind !== 'add' && line.oldLine !== null) {
        oldKeys.push(line.kind === 'del' ? `o${line.oldLine}` : '');
        oldText.push(line.text);
      }
      if (line.kind !== 'del' && line.newLine !== null) {
        newKeys.push(`n${line.newLine}`);
        newText.push(line.text);
      }
    }
    if (oldKeys.some((key) => key !== '')) {
      streams.push({ keys: oldKeys, code: oldText.join('\n') });
    }
    if (newKeys.length > 0) {
      streams.push({ keys: newKeys, code: newText.join('\n') });
    }
  }
  return streams;
};

type Params = {
  path: string;
  hunks: ReadonlyArray<DiffHunk>;
  enabled?: boolean;
};

type State = {
  hunks: ReadonlyArray<DiffHunk> | null;
  map: DiffTokenMap | null;
};

export const useDiffTokens = ({ path, hunks, enabled = true }: Params): DiffTokenMap | null => {
  const lang: SyntaxLang | null = useMemo(() => languageForPath(path), [path]);
  const [state, setState] = useState<State>({ hunks: null, map: null });

  useEffect(() => {
    if (!enabled || lang === null || hunks.length === 0) {
      return;
    }
    let live = true;
    const streams = buildDiffStreams(hunks);
    void Promise.all(streams.map((stream) => highlightCode(stream.code, lang))).then((results) => {
      if (!live) {
        return;
      }
      const map = new Map<string, ReadonlyArray<SyntaxToken>>();
      results.forEach((lines, index) => {
        const stream = streams[index];
        if (!lines || !stream) {
          return;
        }
        stream.keys.forEach((key, lineIndex) => {
          const tokens = lines[lineIndex];
          if (key !== '' && tokens) {
            map.set(key, tokens);
          }
        });
      });
      setState({ hunks, map });
    });
    return () => {
      live = false;
    };
  }, [enabled, hunks, lang]);

  return state.hunks === hunks ? state.map : null;
};
