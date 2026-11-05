import { Marked, type Tokens } from 'marked';
import { SITE } from '../site';
import { escapeHtml } from './escapeHtml';
import { stripComments } from './stripComments';
import { themePictures } from './themePictures';

type Params = {
  readonly source: string;
  readonly directory: string;
};

const FEATURE_DOC = /^\/docs\/features\/([a-z-]+)\.md$/;
const EXTERNAL = /^(?:[a-z]+:|#)/i;

const githubSlug = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-');

type HrefParams = {
  readonly href: string;
  readonly directory: string;
};

const siteHref = ({ href, directory }: HrefParams) => {
  if (EXTERNAL.test(href)) {
    return href;
  }
  const url = new URL(href, `https://repo.invalid/${directory === '' ? '' : `${directory}/`}`);
  const area = url.pathname.match(FEATURE_DOC)?.[1];
  if (area !== undefined) {
    return `${SITE.doc(area)}${url.hash}`;
  }
  return `${SITE.repo}/blob/main${url.pathname}${url.hash}`;
};

export const renderMarkdown = ({ source, directory }: Params) => {
  const slugs = new Map<string, number>();
  const uniqueSlug = (text: string) => {
    const base = githubSlug(text);
    const seen = slugs.get(base) ?? 0;
    slugs.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen}`;
  };
  const marked = new Marked({
    gfm: true,
    walkTokens: (token) => {
      if (token.type === 'link') {
        const link = token as Tokens.Link;
        link.href = siteHref({ href: link.href, directory });
      }
    },
    renderer: {
      heading({ tokens, depth, text }) {
        const level = Math.min(6, Math.max(2, depth - 1));
        return `<h${level} id="${uniqueSlug(text)}">${this.parser.parseInline(tokens)}</h${level}>\n`;
      },
      html({ text }) {
        return themePictures({ html: text });
      },
      image({ href, title, text }) {
        const titleAttribute =
          title === null || title === undefined ? '' : ` title="${escapeHtml(title)}"`;
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttribute} loading="lazy" decoding="async">`;
      },
    },
  });
  return marked.parse(stripComments({ source }), { async: false });
};
