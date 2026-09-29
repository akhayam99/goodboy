type GetParams = {
  readonly source: unknown;
  readonly key: string;
};

const readKey = ({ source, key }: GetParams): unknown => {
  if (typeof source !== 'object' || source === null) {
    return undefined;
  }
  return Reflect.get(source, key);
};

const openConsentPreferences = () => {
  const consent = readKey({ source: readKey({ source: window, key: '_iub' }), key: 'cs' });
  const api = readKey({ source: consent, key: 'api' });
  const open = readKey({ source: api, key: 'openPreferences' });
  if (typeof open !== 'function') {
    return;
  }
  Reflect.apply(open, api, []);
};

export const CookieSettings = () => (
  <button type="button" className="footerLink" onClick={openConsentPreferences}>
    Cookie settings
  </button>
);
