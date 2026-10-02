import { LATEST_VERSION } from './latestVersion';
import { SITE } from '../site';

export type AssetKind = 'dmg' | 'appimage' | 'deb' | 'rpm';

export type AssetUrls = Readonly<Record<AssetKind, string>>;

const ASSET_NAMES: Readonly<Record<AssetKind, (version: string) => string>> = {
  dmg: (version) => `Goodboy_${version}_universal.dmg`,
  appimage: (version) => `Goodboy_${version}_amd64.AppImage`,
  deb: (version) => `Goodboy_${version}_amd64.deb`,
  rpm: (version) => `Goodboy-${version}-1.x86_64.rpm`,
};

const ASSET_SUFFIXES: Readonly<Record<AssetKind, string>> = {
  dmg: '.dmg',
  appimage: '.appimage',
  deb: '.deb',
  rpm: '.rpm',
};

const KINDS = Object.keys(ASSET_NAMES) as readonly AssetKind[];

const buildUrl = (kind: AssetKind) =>
  `${SITE.releaseDownloads}/v${LATEST_VERSION}/${ASSET_NAMES[kind](LATEST_VERSION)}`;

export const BUILD_ASSET_URLS: AssetUrls = {
  dmg: buildUrl('dmg'),
  appimage: buildUrl('appimage'),
  deb: buildUrl('deb'),
  rpm: buildUrl('rpm'),
};

type ApiAsset = {
  readonly name?: unknown;
  readonly browser_download_url?: unknown;
};

const isDownloadUrl = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(`${SITE.releaseDownloads}/`);

export const resolveAssetUrls = (payload: unknown): AssetUrls => {
  const assets = (payload as { readonly assets?: unknown } | null)?.assets;
  if (!Array.isArray(assets)) {
    return BUILD_ASSET_URLS;
  }
  const resolved = Object.fromEntries(
    KINDS.map((kind) => {
      const match = (assets as readonly ApiAsset[]).find(
        (asset) =>
          typeof asset.name === 'string' &&
          asset.name.toLowerCase().endsWith(ASSET_SUFFIXES[kind]) &&
          isDownloadUrl(asset.browser_download_url),
      );
      return [kind, (match?.browser_download_url as string | undefined) ?? BUILD_ASSET_URLS[kind]];
    }),
  );
  return resolved as AssetUrls;
};
