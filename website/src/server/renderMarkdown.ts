import { Marked, type Tokens } from 'marked';
import { SITE } from '../site';

type Params = {
  readonly source: string;
  readonly directory: string;
};

const COMMENT = /<!--[\s\S]*?-->/g;
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

type ImageParams = {
  readonly html: string;
  readonly isFirst: boolean;
};

const lazyImages = ({ html, isFirst }: ImageParams) =>
  html.replace(/<img(?![^>]*\sloading=)/g, () =>
    isFirst ? '<img decoding="async"' : '<img loading="lazy" decoding="async"',
  );

export const renderMarkdown = ({ source, directory }: Params) => {
  const slugs = new Map<string, number>();
  let imageCount = 0;
  const uniqueSlug = (text: string) => {
    const base = githubSlug(text);
    const seen = slugs.get(base) ?? 0;
    slugs.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen}`;
  };
  const withImages = (html: string) => {
    const count = (html.match(/<img/g) ?? []).length;
    const result = lazyImages({ html, isFirst: imageCount === 0 });
    imageCount += count;
    return result;
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
        return withImages(text);
      },
      image({ href, title, text }) {
        const titleAttribute = title === null || title === undefined ? '' : ` title="${title}"`;
        return withImages(`<img src="${href}" alt="${text}"${titleAttribute}>`);
      },
    },
  });
  return marked.parse(source.replace(COMMENT, ''), { async: false });
};
