import type { ReviewTarget } from './resolveReviewTarget';

type Params = {
  readonly url: string;
  readonly prNumber: number;
};

export const githubReviewTarget = ({ url, prNumber }: Params): ReviewTarget | null => {
  try {
    const segments = new URL(url).pathname.split('/').filter((segment) => segment.length > 0);
    const owner = segments[0];
    const name = segments[1];
    if (owner == null || name == null) {
      return null;
    }
    return { provider: 'github', repo: `${owner}/${name}`, prNumber };
  } catch {
    return null;
  }
};
