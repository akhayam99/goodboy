import type { SyntaxLang } from './languages';
import type { SyntaxLines } from './theme';

export type HighlightRequest = {
  id: number;
  code: string;
  lang: SyntaxLang;
};

export type HighlightResponse = {
  id: number;
  lines: SyntaxLines | null;
};
