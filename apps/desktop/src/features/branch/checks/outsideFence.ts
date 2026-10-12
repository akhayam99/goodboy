type Params = {
  readonly lines: ReadonlyArray<string>;
};

export const outsideFence = ({ lines }: Params): ReadonlyArray<boolean> => {
  let fence = '';
  return lines.map((line) => {
    const trimmed = line.trimStart();
    const marker = /^(\x60{3,}|~{3,})/.exec(trimmed)?.[1];
    if (marker === undefined) {
      return fence === '';
    }
    if (fence === '') {
      fence = marker;
      return false;
    }
    if (marker[0] === fence[0] && marker.length >= fence.length && trimmed.trim() === marker) {
      fence = '';
    }
    return false;
  });
};
