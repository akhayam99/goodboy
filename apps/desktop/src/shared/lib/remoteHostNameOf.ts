type Params = {
  readonly url: string;
};

export const remoteHostNameOf = ({ url }: Params): string | null => {
  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }
  const scpLike = /^[\w.-]+@([^:]+):/.exec(trimmed);
  const scpHost = scpLike?.[1];
  if (scpHost !== undefined) {
    return scpHost.toLowerCase();
  }
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
};
