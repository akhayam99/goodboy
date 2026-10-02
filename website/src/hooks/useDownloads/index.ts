import { useEffect, useState } from 'react';
import { BUILD_ASSET_URLS, resolveAssetUrls, type AssetUrls } from '../../data/downloads';
import { SITE } from '../../site';
import { usePlatform, type Platform } from '../usePlatform';

const CACHE_KEY = 'goodboy.release-assets';

type ApiAssetLike = {
  readonly name?: unknown;
  readonly browser_download_url?: unknown;
};

const readCache = (): AssetUrls | null => {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    return raw === null ? null : resolveAssetUrls({ assets: JSON.parse(raw) });
  } catch {
    return null;
  }
};

const writeCache = (payload: unknown) => {
  try {
    const assets = (payload as { readonly assets?: unknown } | null)?.assets;
    if (Array.isArray(assets)) {
      const slim = (assets as readonly ApiAssetLike[]).map((asset) => ({
        name: asset.name,
        browser_download_url: asset.browser_download_url,
      }));
      window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(slim));
    }
  } catch {
    return;
  }
};

let pending: Promise<AssetUrls> | null = null;

const loadAssetUrls = (): Promise<AssetUrls> => {
  const cached = readCache();
  if (cached !== null) {
    return Promise.resolve(cached);
  }
  if (pending === null) {
    pending = fetch(SITE.latestApi, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        writeCache(payload);
        return resolveAssetUrls(payload);
      })
      .catch(() => BUILD_ASSET_URLS);
  }
  return pending;
};

type Downloads = {
  readonly platform: Platform;
  readonly urls: AssetUrls;
  readonly primary: { readonly label: string; readonly href: string };
};

export const useDownloads = (): Downloads => {
  const platform = usePlatform();
  const [urls, setUrls] = useState<AssetUrls>(BUILD_ASSET_URLS);

  useEffect(() => {
    let isActive = true;
    loadAssetUrls().then((resolved) => {
      if (isActive) {
        setUrls(resolved);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  const primary =
    platform === 'linux'
      ? { label: 'Download for Linux', href: urls.appimage }
      : { label: 'Download for macOS', href: urls.dmg };

  return { platform, urls, primary };
};
