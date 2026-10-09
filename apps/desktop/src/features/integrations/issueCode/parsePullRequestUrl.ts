import { pullRequestNumberFromUrl } from '../../review/pullRequestNumberFromUrl';

export type ParsedPullRequestUrl = {
  readonly repo: string;
  readonly number: number;
  readonly url: string;
};

const GITHUB_HOSTS: ReadonlySet<string> = new Set(['github.com', 'www.github.com']);

export const parsePullRequestUrl = (input: string): ParsedPullRequestUrl | null => {
  const raw = input.trim();
  const lowered = raw.toLowerCase();
  if (!lowered.startsWith('http://') && !lowered.startsWith('https://')) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }
  const [owner, repo, section] = url.pathname.split('/').filter((part) => part !== '');
  if (owner === undefined || repo === undefined || section !== 'pull') {
    return null;
  }
  const number = pullRequestNumberFromUrl({ url: url.pathname });
  if (number === null) {
    return null;
  }
  return {
    repo: `${owner}/${repo}`,
    number,
    url: `https://github.com/${owner}/${repo}/pull/${number}`,
  };
};
