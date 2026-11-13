import { isAtLineStart, readDetailsTag, readHtmlMedia } from './htmlShapes';

type TagNameParams = {
  readonly ch: string | undefined;
};

const isTagNameStart = ({ ch }: TagNameParams): boolean =>
  ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));

type Params = {
  readonly input: string;
};

export const stripHtml = ({ input }: Params): string => {
  let out = '';
  let i = 0;
  let isInFence = false;
  let detailsDepth = 0;
  const n = input.length;

  while (i < n) {
    const isLineStart = i === 0 || input[i - 1] === '\n';
    if (isLineStart && input.startsWith('```', i)) {
      const lineEnd = input.indexOf('\n', i);
      const end = lineEnd === -1 ? n : lineEnd;
      out += input.slice(i, end);
      i = end;
      isInFence = !isInFence;
      continue;
    }
    if (isInFence) {
      out += input[i];
      i++;
      continue;
    }

    const ch = input[i];

    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        out += input.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }

    if (ch === '<' && input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4);
      if (end !== -1) {
        i = end + 3;
        continue;
      }
    }

    if (ch === '<' && input[i + 1] !== '<') {
      const media = readHtmlMedia({ text: input, index: i });
      if (media !== null) {
        out += input.slice(i, media.end);
        i = media.end;
        continue;
      }
      const tag = readDetailsTag({ text: input, index: i });
      if (tag !== null) {
        const isOpener = tag.name === 'details' && !tag.isClosing;
        const isKept = isOpener ? isAtLineStart({ text: input, index: i }) : detailsDepth > 0;
        if (isKept) {
          if (isOpener) {
            detailsDepth += 1;
          }
          if (tag.name === 'details' && tag.isClosing) {
            detailsDepth -= 1;
          }
          out += input.slice(i, tag.end);
          i = tag.end;
          continue;
        }
      }
    }

    if (ch === '<' && input[i + 1] === '<') {
      let end = i;
      while (input[end] === '<') {
        end += 1;
      }
      out += input[end] === '/' ? '<<' : input.slice(i, end);
      i = end;
      continue;
    }

    if (ch === '<') {
      const isSlashed = input[i + 1] === '/';
      const nameStart = isSlashed ? input[i + 2] : input[i + 1];
      if (isTagNameStart({ ch: nameStart })) {
        const end = input.indexOf('>', i + 1);
        if (end !== -1) {
          i = end + 1;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }

  return out.replace(/&nbsp;/g, ' ');
};
