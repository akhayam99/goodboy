import { remoteHostNameOf } from '../lib/remoteHostNameOf';

export type RemoteHostKind = 'github' | 'gitlab' | 'other' | 'none';

export const projectPathFromRemoteUrl = (url: string | null): string | null => {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  const strip = (path: string): string | null => {
    const cleaned = path
      .replace(/\.git$/, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');
    return cleaned || null;
  };
  const scpLike = /^[\w.-]+@[^:]+:(.+)$/.exec(trimmed);
  if (scpLike?.[1]) {
    return strip(scpLike[1]);
  }
  try {
    return strip(new URL(trimmed).pathname);
  } catch {
    return null;
  }
};

export const classifyRemoteHost = (
  url: string | null,
  gitlabHosts: ReadonlyArray<string>,
): RemoteHostKind => {
  if (!url) {
    return 'none';
  }
  const host = remoteHostNameOf({ url });
  if (!host) {
    return 'other';
  }
  const knownGitlab = gitlabHosts
    .map((h) => remoteHostNameOf({ url: h }) ?? h.trim().toLowerCase())
    .filter(Boolean);
  if (knownGitlab.includes(host) || host.includes('gitlab')) {
    return 'gitlab';
  }
  if (host.includes('github')) {
    return 'github';
  }
  return 'other';
};
