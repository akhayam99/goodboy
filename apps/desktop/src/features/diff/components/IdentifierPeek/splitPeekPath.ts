type Params = { readonly path: string };

const DIRECTORY_LIMIT = 30;
const DIRECTORY_EDGE = 14;

export const splitPeekPath = ({ path }: Params) => {
  const cut = path.lastIndexOf('/');
  if (cut < 0) {
    return { directory: '', separator: '', name: path };
  }
  const directory = path.slice(0, cut);
  return {
    directory:
      directory.length > DIRECTORY_LIMIT
        ? `${directory.slice(0, DIRECTORY_EDGE)}…${directory.slice(-DIRECTORY_EDGE)}`
        : directory,
    separator: '/',
    name: path.slice(cut + 1),
  };
};
