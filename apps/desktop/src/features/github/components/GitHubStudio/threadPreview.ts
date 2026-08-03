type Params = {
  readonly body: string;
};

export const threadPreview = ({ body }: Params): string => {
  const firstLine =
    body
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  return firstLine
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/[*_`]/g, '')
    .trim();
};
