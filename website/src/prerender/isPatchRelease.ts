type Params = {
  readonly version: string;
};

export const isPatchRelease = ({ version }: Params) => {
  const parts = version.split('.');
  return parts.length === 3 && parts[2] !== '0';
};
