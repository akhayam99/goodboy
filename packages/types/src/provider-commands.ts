import type { ProviderId } from './provider-registry';

export type ProviderLifecycleAction = 'install' | 'login' | 'logout';

export type ProviderPlatform = 'darwin' | 'linux' | 'win32';

export type ProviderPlatformCommands = {
  readonly darwin: string;
  readonly linux: string;
  readonly win32: string;
};

export type ProviderLifecycleCommands = {
  readonly install: ProviderPlatformCommands;
  readonly login?: string;
  readonly logout: string;
};
