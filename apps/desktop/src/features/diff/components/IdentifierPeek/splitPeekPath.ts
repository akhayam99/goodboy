type Params = { readonly path: string };

const DIRECTORY_LIMIT = 26;
const ELLIPSIS = '…/';

export const splitPeekPath = ({ path }: Params) => {
  const cut = path.lastIndexOf('/');
  if (cut < 0) {
    return { directory: '', separator: '', name: path, isCut: false };
  }
  const segments = path.slice(0, cut).split('/');
  let kept: ReadonlyArray<string> = [];
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const next = [segments[index] ?? '', ...kept];
    if (kept.length > 0 && next.join('/').length > DIRECTORY_LIMIT) {
      break;
    }
    kept = next;
  }
  const isCut = kept.length < segments.length;
  return {
    directory: `${isCut ? ELLIPSIS : ''}${kept.join('/')}`,
    separator: '/',
    name: path.slice(cut + 1),
    isCut,
  };
};
