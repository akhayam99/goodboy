import { trackAttributes } from './trackAttributes';

type Params = {
  readonly os: 'macos' | 'linux';
  readonly packageName: 'dmg' | 'appimage' | 'deb' | 'rpm';
  readonly location: 'hero' | 'install';
  readonly version: string;
};

export const downloadTrack = ({ os, packageName, location, version }: Params) =>
  trackAttributes({
    event: 'download_click',
    params: {
      platform: os,
      package: packageName,
      cta_location: location,
      app_version: version,
    },
  });
