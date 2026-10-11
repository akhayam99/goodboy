import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { exceedsHighlightCap } from './caps';
import { LANGUAGE_LOADERS, type SyntaxLang } from './languages';
import { SENTINEL_THEME, kindForColor, type SyntaxLines, type SyntaxToken } from './theme';

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
