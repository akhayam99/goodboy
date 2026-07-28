import { STORAGE_PREFIXES } from './storage-keys';

type ModelParams = {
  readonly accountId: string;
  readonly model: string;
};

type SubscribeParams = {
  readonly onChange: () => void;
};

type Advisory = {
  readonly has: (params: ModelParams) => boolean;
  readonly mark: (params: ModelParams) => void;
  readonly clear: (params: ModelParams) => void;
  readonly clearAll: (params: Record<string, never>) => void;
  readonly subscribe: (params: SubscribeParams) => () => void;
};

const EVENT_NAME = 'goodboy:cursor-max-mode-advisory';

type EmptyParams = Record<string, never>;

const storageKey = ({ accountId, model }: ModelParams): string =>
  `${STORAGE_PREFIXES.cursorMaxMode}${encodeURIComponent(accountId)}:${encodeURIComponent(model)}`;

const notify = ({}: EmptyParams): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(EVENT_NAME));
};

export const cursorMaxModeAdvisory: Advisory = {
  has: ({ accountId, model }) => {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    try {
      return localStorage.getItem(storageKey({ accountId, model })) === '1';
    } catch {
      return false;
    }
  },
  mark: ({ accountId, model }) => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(storageKey({ accountId, model }), '1');
      notify({});
    } catch {
      return;
    }
  },
  clear: ({ accountId, model }) => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(storageKey({ accountId, model }));
      notify({});
    } catch {
      return;
    }
  },
  clearAll: ({}) => {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      const keys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(STORAGE_PREFIXES.cursorMaxMode) === true) {
          keys.push(key);
        }
      }
      for (const key of keys) {
        localStorage.removeItem(key);
      }
      notify({});
    } catch {
      return;
    }
  },
  subscribe: ({ onChange }) => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  },
};
