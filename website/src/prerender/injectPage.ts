const HTML_MARK = '<!--app-html-->';
const HEAD_MARK = '<!--app-head-->';

type Params = {
  readonly template: string;
  readonly html: string;
  readonly head?: string;
};

type ReplaceParams = {
  readonly source: string;
  readonly mark: string;
  readonly value: string;
};

const replaceMark = ({ source, mark, value }: ReplaceParams) => {
  if (!source.includes(mark)) {
    throw new Error(`template has no ${mark}`);
  }
  return source.replace(mark, () => value);
};

export const injectPage = ({ template, html, head }: Params) => {
  const withHtml = replaceMark({ source: template, mark: HTML_MARK, value: html });
  return head === undefined
    ? withHtml
    : replaceMark({ source: withHtml, mark: HEAD_MARK, value: head });
};
