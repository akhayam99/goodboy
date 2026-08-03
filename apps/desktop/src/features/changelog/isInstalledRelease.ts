type Params = {
  readonly tag: string;
  readonly installed: string | null;
};

export const isInstalledRelease = ({ tag, installed }: Params): boolean => {
  if (installed == null || installed.trim() === '') {
    return false;
  }
  return tag.trim().replace(/^v/i, '') === installed.trim().replace(/^v/i, '');
};
