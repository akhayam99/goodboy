import type { CodeHighlighter } from '@goodboy/ui';
import { highlightCode, languageForName, peekHighlight } from '.';

export const APP_CODE_HIGHLIGHTER: CodeHighlighter = {
  highlight: (code, name) => {
    const lang = languageForName(name);
    return lang === null ? Promise.resolve(null) : highlightCode(code, lang);
  },
  peek: (code, name) => {
    const lang = languageForName(name);
    return lang === null ? null : peekHighlight(code, lang);
  },
};
