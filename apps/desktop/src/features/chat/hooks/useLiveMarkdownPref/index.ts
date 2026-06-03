import { useCallback, useState } from 'react';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';

const KEY = STORAGE_KEYS.composerLiveMarkdown;

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function useLiveMarkdownPref(): readonly [boolean, () => void] {
  const [enabled, setEnabled] = useState(read);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(KEY, next ? 'true' : 'false');
      } catch {
        return prev;
      }
      return next;
    });
  }, []);

  return [enabled, toggle];
}
