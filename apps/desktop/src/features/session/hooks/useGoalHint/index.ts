import { useEffect, useState } from 'react';
import type { SessionId } from '@goodboy/types';

const STORAGE_KEY = 'goodboy:goal-hint-dismissed:v1';
const MAX_IDS = 500;

type ReadParams = { readonly fallback: ReadonlyArray<string> };

const readIds = ({ fallback }: ReadParams): ReadonlyArray<string> => {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) {
      return fallback;
    }
    return value.filter((entry): entry is string => typeof entry === 'string').slice(-MAX_IDS);
  } catch {
    return fallback;
  }
};

type Params = { readonly sessionId: SessionId };

export const useGoalHint = ({ sessionId }: Params) => {
  const [ids, setIds] = useState(() => readIds({ fallback: [] }));
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setIds((current) => readIds({ fallback: current }));
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const dismiss = () => {
    const next = [...new Set([...readIds({ fallback: ids }), sessionId])].slice(-MAX_IDS);
    setIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setIds(next);
    }
  };
  return { isDismissed: ids.includes(sessionId), dismiss };
};
