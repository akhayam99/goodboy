import { LATEST_VERSION } from '../data/latestVersion';
import type { AssetKind, AssetUrls } from './downloads';
import { versionOfUrl } from './versionOfUrl';

export type AssetVersions = Readonly<Record<AssetKind, string>>;

type Params = {
  readonly urls: AssetUrls;
};

export const assetVersions = ({ urls }: Params): AssetVersions => ({
  dmg: versionOfUrl({ url: urls.dmg }) ?? LATEST_VERSION,
  appimage: versionOfUrl({ url: urls.appimage }) ?? LATEST_VERSION,
  deb: versionOfUrl({ url: urls.deb }) ?? LATEST_VERSION,
  rpm: versionOfUrl({ url: urls.rpm }) ?? LATEST_VERSION,
});
