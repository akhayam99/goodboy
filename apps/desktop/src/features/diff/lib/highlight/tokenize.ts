import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { LANGUAGE_LOADERS, type SyntaxLang } from './languages';
import { SENTINEL_THEME, kindForColor, type SyntaxLines, type SyntaxToken } from './theme';

export const MAX_HIGHLIGHT_LINES = 5000;
export const MAX_HIGHLIGHT_LINE_LENGTH = 1000;

let highlighter: Promise<HighlighterCore> | null = null;
const loadedLangs = new Map<SyntaxLang, Promise<void>>();

const getHighlighter = (): Promise<HighlighterCore> => {
  highlighter ??= createHighlighterCore({
    themes: [SENTINEL_THEME],
    langs: [],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighter;
};

const ensureLang = async (core: HighlighterCore, lang: SyntaxLang): Promise<void> => {
  const pending = loadedLangs.get(lang) ?? core.loadLanguage(LANGUAGE_LOADERS[lang]);
  loadedLangs.set(lang, pending);
  await pending;
};

export const exceedsHighlightCap = (code: string): boolean => {
  let lines = 1;
  let lineStart = 0;
  for (let i = 0; i < code.length; i++) {
    if (code.charCodeAt(i) !== 10) {
      continue;
    }
    if (i - lineStart > MAX_HIGHLIGHT_LINE_LENGTH) {
      return true;
    }
    lines += 1;
    lineStart = i + 1;
    if (lines > MAX_HIGHLIGHT_LINES) {
      return true;
    }
  }
  return code.length - lineStart > MAX_HIGHLIGHT_LINE_LENGTH;
};

const mergeLine = (
  tokens: ReadonlyArray<{ content: string; color?: string }>,
): ReadonlyArray<SyntaxToken> => {
  const out: SyntaxToken[] = [];
  for (const token of tokens) {
    if (token.content.length === 0) {
      continue;
    }
    const kind = /^\s+$/.test(token.content) ? 'plain' : kindForColor(token.color);
    const last = out[out.length - 1];
    if (last && last.kind === kind) {
      out[out.length - 1] = { text: last.text + token.content, kind: last.kind };
      continue;
    }
    out.push({ text: token.content, kind });
  }
  return out;
};

type TokenizeParams = {
  code: string;
  lang: SyntaxLang;
};

export const tokenizeCode = async ({ code, lang }: TokenizeParams): Promise<SyntaxLines | null> => {
  if (code.length === 0 || exceedsHighlightCap(code)) {
    return null;
  }
  try {
    const core = await getHighlighter();
    await ensureLang(core, lang);
    const result = core.codeToTokens(code, { lang, theme: SENTINEL_THEME.name ?? '' });
    return result.tokens.map(mergeLine);
  } catch {
    return null;
  }
};
