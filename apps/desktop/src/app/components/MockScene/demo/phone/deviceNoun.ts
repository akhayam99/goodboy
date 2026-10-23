export type DeviceNoun = 'Mac' | 'computer';

type Params = {
  readonly userAgent: string;
  readonly platform: string | undefined;
};

const LINUX = /\bLinux\b/i;
const ANDROID = /\bAndroid\b/i;

export const deviceNoun = ({ userAgent, platform }: Params): DeviceNoun => {
  const source = platform ?? userAgent;
  const isLinux = LINUX.test(source) && !ANDROID.test(source);
  return isLinux ? 'computer' : 'Mac';
};
