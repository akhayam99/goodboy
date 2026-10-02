import { useEffect, useState } from 'react';
import { formatStars } from '../../data/formatStars';
import { SITE } from '../../site';

const CACHE_KEY = 'goodboy.stars';

const readCache = (): number | null => {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
};

const writeCache = (count: number) => {
  try {
    window.sessionStorage.setItem(CACHE_KEY, String(count));
  } catch {
    return;
  }
};

const readCount = (payload: unknown): number | null => {
  const count = (payload as { readonly stargazers_count?: unknown } | null)?.stargazers_count;
  return typeof count === 'number' ? count : null;
};

let pending: Promise<number | null> | null = null;

const loadStarCount = (): Promise<number | null> => {
  const cached = readCache();
  if (cached !== null) {
    return Promise.resolve(cached);
  }
  if (pending === null) {
    pending = fetch(SITE.repoApi, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        const count = readCount(payload);
        if (count !== null) {
          writeCache(count);
        }
        return count;
      })
      .catch(() => null);
  }
  return pending;
};

export const useStarCount = (): string | null => {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    loadStarCount().then((count) => {
      if (isActive && count !== null) {
        setLabel(formatStars(count));
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  return label;
};
