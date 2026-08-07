import { useEffect, useState, type ReactNode } from 'react';
import { LinkButton } from '../components/ui';
import { useInView } from '../components/Reveal';

const RELEASES_LATEST = 'https://github.com/akhayam99/goodboy/releases/latest';
const LATEST_RELEASE_API = 'https://api.github.com/repos/akhayam99/goodboy/releases/latest';

const ASSET_SUFFIX = {
  dmg: '.dmg',
  appImage: '.appimage',
  deb: '.deb',
  rpm: '.rpm',
} as const;

type AssetKey = keyof typeof ASSET_SUFFIX;
type AssetLink = { href: string; direct: boolean };

const ASSET_KEYS = Object.keys(ASSET_SUFFIX) as ReadonlyArray<AssetKey>;

const useLatestAssets = (): Record<AssetKey, AssetLink> => {
  const [urls, setUrls] = useState<Partial<Record<AssetKey, string>>>({});
  useEffect(() => {
    let cancelled = false;
    fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { assets?: Array<{ name?: string; browser_download_url?: string }> }) => {
        const found: Partial<Record<AssetKey, string>> = {};
        for (const key of ASSET_KEYS) {
          const asset = data.assets?.find((a) => a.name?.toLowerCase().endsWith(ASSET_SUFFIX[key]));
          if (asset?.browser_download_url) found[key] = asset.browser_download_url;
        }
        if (!cancelled) setUrls(found);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return ASSET_KEYS.reduce(
    (acc, key) => {
      const url = urls[key];
      acc[key] = url ? { href: url, direct: true } : { href: RELEASES_LATEST, direct: false };
      return acc;
    },
    {} as Record<AssetKey, AssetLink>,
  );
};

const LINUX_PACKAGES: ReadonlyArray<{ key: AssetKey; label: string }> = [
  { key: 'appImage', label: 'AppImage' },
  { key: 'deb', label: '.deb' },
  { key: 'rpm', label: '.rpm' },
];

const brewLine = 'brew install --cask akhayam99/tap/goodboy';

const sourceLines = [
  { prompt: '$', command: 'git clone https://github.com/akhayam99/goodboy.git', muted: false },
  { prompt: '$', command: 'cd goodboy && pnpm install', muted: false },
  { prompt: '$', command: 'pnpm tauri:build', muted: true },
];

function TerminalFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-soft bg-[oklch(0.22_0.007_255)] text-left">
      <div className="flex items-center gap-2 border-b border-border-soft bg-[oklch(0.27_0.008_255)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-warning" aria-hidden />
        <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden />
        <span className="ml-3 font-mono text-[10.5px] text-muted-foreground">{label}</span>
      </div>
      <div className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-[1.9]">
        {children}
      </div>
    </div>
  );
}

export function CTA() {
  const { ref, inView } = useInView<HTMLElement>();
  const assets = useLatestAssets();
  return (
    <section
      id="cta"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="reveal mx-auto w-full max-w-3xl px-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
          Open source, MIT
        </p>
        <h2 className="mx-auto mt-7 max-w-xl text-[18px] leading-[1.5] font-semibold text-foreground/85 sm:text-[20px]">
          Keep your thread on your own machine
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-[1.65] text-foreground/80 sm:text-[17px]">
          <strong className="font-semibold text-foreground">No waitlist, no sign-up.</strong>{' '}
          Connect a command-line tool you already use and you&apos;re running in a minute.
        </p>

        <div className="mx-auto mt-12 max-w-lg pointer-fine:hidden">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            When you&apos;re back at your machine
          </p>
          <code className="mt-2.5 block overflow-x-auto whitespace-nowrap rounded-lg border border-border-soft bg-[oklch(0.22_0.007_255)] px-4 py-2.5 text-left font-mono text-[12.5px] text-foreground">
            {brewLine}
          </code>
          <p className="mt-2.5 text-[11.5px] text-muted-foreground/70">
            That is macOS. The .dmg is on the GitHub releases too, next to the Linux AppImage, .deb
            and .rpm.
          </p>
          <div className="mt-7 flex flex-col items-center gap-3">
            <LinkButton
              href="https://github.com/akhayam99/goodboy"
              target="_blank"
              rel="noreferrer"
              size="lg"
              variant="primary"
              className="w-full max-w-xs"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
              </svg>
              Star on GitHub
            </LinkButton>
            <LinkButton
              href="https://github.com/akhayam99/goodboy/blob/main/README.md"
              target="_blank"
              rel="noreferrer"
              size="lg"
              variant="ghost"
            >
              Read the docs
            </LinkButton>
          </div>
        </div>

        <div className="mx-auto mt-12 hidden max-w-lg pointer-fine:block">
          <LinkButton
            href={assets.dmg.href}
            target={assets.dmg.direct ? undefined : '_blank'}
            rel={assets.dmg.direct ? undefined : 'noreferrer'}
            size="lg"
            variant="primary"
            className="w-full sm:w-auto"
          >
            Download for macOS
          </LinkButton>
          <p className="mt-3 text-[12px] text-muted-foreground/70">
            Universal build &middot; Intel &amp; Apple Silicon
          </p>

          <div className="mt-5 flex items-center gap-3 text-left">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/60">
              or brew
            </span>
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border-soft bg-[oklch(0.22_0.007_255)] px-4 py-2.5 font-mono text-[12.5px] text-foreground">
              {brewLine}
            </code>
          </div>

          <div className="mt-9 text-left">
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Linux &middot; x86_64
            </p>
            <div className="flex flex-wrap gap-2">
              {LINUX_PACKAGES.map(({ key, label }) => (
                <LinkButton
                  key={key}
                  href={assets[key].href}
                  target={assets[key].direct ? undefined : '_blank'}
                  rel={assets[key].direct ? undefined : 'noreferrer'}
                  size="md"
                  variant="secondary"
                >
                  {label}
                </LinkButton>
              ))}
            </div>
            <p className="mt-2.5 text-[11.5px] text-muted-foreground/70">
              Same tagged build as the macOS one. In-app updates stay macOS-only for now, so a new
              version is a new package from the same page.
            </p>
          </div>

          <div className="mt-9 text-left">
            <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Windows &middot; from source
            </p>
            <TerminalFrame label="~/work">
              {sourceLines.map((l) => (
                <div key={l.command} className="flex items-start gap-2 whitespace-nowrap">
                  <span className="shrink-0 select-none text-muted-foreground">{l.prompt}</span>
                  <span className={l.muted ? 'text-primary' : 'text-foreground'}>{l.command}</span>
                </div>
              ))}
            </TerminalFrame>
            <p className="mt-2.5 text-[11.5px] text-muted-foreground/70">
              Needs a Rust toolchain. A prebuilt Windows binary is still to come.
            </p>
          </div>
        </div>

        <div className="mt-10 hidden flex-col items-center justify-center gap-3 pointer-fine:flex sm:flex-row">
          <LinkButton
            href="https://github.com/akhayam99/goodboy"
            target="_blank"
            rel="noreferrer"
            size="lg"
            variant="secondary"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
            </svg>
            View on GitHub
          </LinkButton>
          <LinkButton
            href="https://github.com/akhayam99/goodboy/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            size="lg"
            variant="secondary"
          >
            Read the docs
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
