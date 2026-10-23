type Params = {
  readonly frame: HTMLIFrameElement;
};

export const isFrameMounted = ({ frame }: Params): boolean => {
  const document = frame.contentDocument;
  if (document === null) {
    return true;
  }
  const root = document.getElementById('root');
  if (root === null) {
    return true;
  }
  return document.getElementById('boot-shell') === null && root.childElementCount > 0;
};
