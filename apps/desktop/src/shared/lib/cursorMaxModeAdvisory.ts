import { STORAGE_PREFIXES, persistedPref } from './storage-keys';

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

const advisoryPref = ({ accountId, model }: ModelParams) =>
  persistedPref<boolean>({
    key: storageKey({ accountId, model }),
    parse: (raw) => raw === '1',
    serialize: () => '1',
    fallback: false,
  });

export const cursorMaxModeAdvisory: Advisory = {
  has: ({ accountId, model }) => advisoryPref({ accountId, model }).read(),
  mark: ({ accountId, model }) => {
    advisoryPref({ accountId, model }).write(true);
    notify({});
  },
  clear: ({ accountId, model }) => {
    advisoryPref({ accountId, model }).clear();
    notify({});
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
