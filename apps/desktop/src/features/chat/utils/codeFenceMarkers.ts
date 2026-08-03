const MARKER_RE = /<<\/?[a-z-]+(?:\s[^>]*?)?>>/g;

type Params = {
  readonly text: string;
};

export const codeFenceMarkers = ({ text }: Params): string =>
  text.replace(MARKER_RE, (marker, offset: number) => {
    if (text[offset - 1] === '`' || text[offset + marker.length] === '`') {
      return marker;
    }
    return `\`${marker}\``;
  });
