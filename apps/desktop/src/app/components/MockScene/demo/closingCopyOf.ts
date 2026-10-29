import type { ProviderPlatform } from '@goodboy/types';

export type ClosingCopy = {
  readonly instruction: string;
  readonly download: string | undefined;
};

const COPY = {
  darwin: {
    instruction: 'Press **Download for macOS** to get Goodboy.',
    download: 'Download for macOS',
  },
  linux: {
    instruction: 'Press **Download for Linux** to get Goodboy.',
    download: 'Download for Linux',
  },
  win32: {
    instruction: 'Goodboy runs on macOS and Linux today.',
    download: undefined,
  },
} as const satisfies Record<ProviderPlatform, ClosingCopy>;

type Params = {
  readonly platform: ProviderPlatform;
};

export const closingCopyOf = ({ platform }: Params): ClosingCopy => COPY[platform];
