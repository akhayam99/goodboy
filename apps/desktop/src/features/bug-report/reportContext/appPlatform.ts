import { invokeCommand } from '../../../shared/lib/invokeCommand';

export type AppPlatform = {
  readonly os: string;
  readonly osVersion: string | null;
  readonly arch: string;
  readonly buildSha: string | null;
};

const OS_LABELS: Readonly<Record<string, string>> = {
  macos: 'macOS',
  linux: 'Linux',
  windows: 'Windows',
};

const ARCH_LABELS: Readonly<Record<string, string>> = {
  aarch64: 'arm64',
  x86_64: 'x64',
};

export const readAppPlatform = async (): Promise<AppPlatform | null> => {
  try {
    return await invokeCommand<AppPlatform>('app_platform');
  } catch {
    return null;
  }
};

type SystemLabelParams = {
  readonly platform: AppPlatform | null;
};

export const systemLabel = ({ platform }: SystemLabelParams): string => {
  if (platform === null) {
    return 'unknown';
  }
  const os = OS_LABELS[platform.os] ?? platform.os;
  const arch = ARCH_LABELS[platform.arch] ?? platform.arch;
  return [os, platform.osVersion, arch]
    .filter((part): part is string => part !== null && part !== '')
    .join(' ');
};
