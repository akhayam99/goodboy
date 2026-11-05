const PICTURE_OPEN = '<picture>';
const PICTURE_CLOSE = '</picture>';
const DARK_MEDIA = '(prefers-color-scheme: dark)';
const ATTRIBUTE = /([a-z][a-z-]*)="([^"]*)"/g;

type Params = {
  readonly html: string;
};

type Attributes = ReadonlyMap<string, string>;

type TagParams = {
  readonly block: string;
  readonly name: string;
};

const tagAttributes = ({ block, name }: TagParams): Attributes | null => {
  const start = block.indexOf(`<${name}`);
  if (start === -1) {
    return null;
  }
  const end = block.indexOf('>', start);
  const tag = block.slice(start, end === -1 ? undefined : end);
  return new Map([...tag.matchAll(ATTRIBUTE)].map((match) => [match[1], match[2]]));
};

type ImageParams = {
  readonly image: Attributes;
  readonly src: string;
  readonly theme: 'light' | 'dark';
};

const themedImage = ({ image, src, theme }: ImageParams) => {
  const kept = [...image.entries()]
    .filter(([key]) => key !== 'src' && key !== 'class' && key !== 'loading')
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  return `<img class="themeImage ${theme}" src="${src}"${kept} loading="lazy" decoding="async">`;
};

const themePicture = ({ html: block }: Params) => {
  const source = tagAttributes({ block, name: 'source' });
  const image = tagAttributes({ block, name: 'img' });
  const dark = source?.get('srcset');
  const light = image?.get('src');
  if (
    source?.get('media') !== DARK_MEDIA ||
    image === null ||
    dark === undefined ||
    light === undefined
  ) {
    return block;
  }
  return [
    themedImage({ image, src: light, theme: 'light' }),
    themedImage({ image, src: dark, theme: 'dark' }),
  ].join('');
};

export const themePictures = ({ html }: Params) => {
  const parts: string[] = [];
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf(PICTURE_OPEN, index);
    const end = start === -1 ? -1 : html.indexOf(PICTURE_CLOSE, start);
    if (end === -1) {
      parts.push(html.slice(index));
      break;
    }
    parts.push(html.slice(index, start));
    parts.push(themePicture({ html: html.slice(start, end + PICTURE_CLOSE.length) }));
    index = end + PICTURE_CLOSE.length;
  }
  return parts.join('');
};
