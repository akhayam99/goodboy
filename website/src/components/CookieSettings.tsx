type Iubenda = {
  readonly cs?: {
    readonly api?: {
      readonly openPreferences?: () => void;
    };
  };
};

const readIubenda = (): Iubenda | undefined => {
  const candidate: unknown = Reflect.get(window, '_iub');
  if (typeof candidate !== 'object' || candidate === null) {
    return undefined;
  }
  return candidate;
};

export const CookieSettings = () => {
  const handleClick = () => {
    const open = readIubenda()?.cs?.api?.openPreferences;
    if (open === undefined) {
      return;
    }
    open();
  };

  return (
    <button type="button" className="footerLink" onClick={handleClick}>
      Cookie settings
    </button>
  );
};
