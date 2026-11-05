const REPO_API = 'https://api.github.com/repos/akhayam99/goodboy';
const STAR_FETCH_TIMEOUT_MS = 5000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const fetchStarCount = async (): Promise<number | null> => {
  try {
    const response = await fetch(REPO_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(STAR_FETCH_TIMEOUT_MS),
    });
    const payload: unknown = response.ok ? await response.json() : null;
    const count = isRecord(payload) ? payload.stargazers_count : null;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
};

export const readStarCount = async (): Promise<number | null> => {
  const cached = process.env.GOODBOY_STARS;
  if (cached !== undefined) {
    const parsed: unknown = JSON.parse(cached);
    return typeof parsed === 'number' ? parsed : null;
  }
  const count = await fetchStarCount();
  process.env.GOODBOY_STARS = JSON.stringify(count);
  return count;
};
