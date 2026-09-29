import { classifyRemoteHost, projectPathFromRemoteUrl } from '../../../shared/lib/remoteHost';

export type CodeHost = 'github' | 'gitlab' | 'bitbucket';

const CODE_HOSTS: ReadonlyArray<CodeHost> = ['github', 'gitlab', 'bitbucket'];

const hostName = (url: string): string | null => {
  const trimmed = url.trim();
  const scpLike = /^[\w.-]+@([^:]+):/.exec(trimmed);
  if (scpLike?.[1]) {
    return scpLike[1].toLowerCase();
  }
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const hostFromRemote = (url: string | null): CodeHost | null => {
  if (url === null || url.trim() === '') {
    return null;
  }
  const name = hostName(url);
  if (name !== null && name.includes('bitbucket')) {
    return 'bitbucket';
  }
  const kind = classifyRemoteHost(url, []);
  return kind === 'github' || kind === 'gitlab' ? kind : null;
};

export const remoteLabel = (url: string | null): string | null => {
  if (url === null) {
    return null;
  }
  const name = hostName(url);
  const path = projectPathFromRemoteUrl(url);
  if (name === null || path === null) {
    return null;
  }
  return `${name}/${path}`;
};

export const hostsInOrder = (preferred: CodeHost | null): ReadonlyArray<CodeHost> =>
  preferred === null ? CODE_HOSTS : [preferred, ...CODE_HOSTS.filter((host) => host !== preferred)];
