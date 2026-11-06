import './Install.css';
import { useEffect, useRef, useState } from 'react';
import { Chapter } from '../../../components/Chapter';
import { StarButton } from '../../../components/StarButton';
import { useDownloads } from '../../../hooks/useDownloads';
import { downloadTrack } from '../../../lib/downloadTrack';
import { SITE } from '../../../lib/site';
import { trackAttributes } from '../../../lib/trackAttributes';

const COPIED_MS = 1500;

export const Install = () => {
  const { platform, urls, versions, primary } = useDownloads();
  const step =
    platform === 'linux' ? 'Get Goodboy for your Linux computer.' : 'Get Goodboy for your Mac.';
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const handleCopy = () => {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
      return;
    }
    navigator.clipboard
      .writeText(SITE.brew)
      .then(() => {
        setIsCopied(true);
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => setIsCopied(false), COPIED_MS);
      })
      .catch(() => setIsCopied(false));
  };

  return (
    <Chapter
      id="install"
      tone="band"
      head={{
        eyebrow: 'Install',
        eyebrowKind: 'page',
        heading: 'Get Goodboy running',
        lead: 'Three steps.',
      }}
    >
      <div className="install">
        <div className="installCta" data-reveal="">
          <div className="onlyFine">
            <a
              className="btn installMain"
              href={primary.href}
              data-download
              {...downloadTrack({
                os: primary.os,
                packageName: primary.packageName,
                location: 'install',
                version: primary.version,
              })}
            >
              {primary.label}
            </a>
            <p className="installAlt">
              {platform === 'linux' ? (
                <>
                  Also as{' '}
                  <a
                    href={urls.deb}
                    data-download
                    {...downloadTrack({
                      os: 'linux',
                      packageName: 'deb',
                      location: 'install',
                      version: versions.deb,
                    })}
                  >
                    .deb
                  </a>{' '}
                  and{' '}
                  <a
                    href={urls.rpm}
                    data-download
                    {...downloadTrack({
                      os: 'linux',
                      packageName: 'rpm',
                      location: 'install',
                      version: versions.rpm,
                    })}
                  >
                    .rpm
                  </a>
                  .{' '}
                  <a
                    href={urls.dmg}
                    data-download
                    {...downloadTrack({
                      os: 'macos',
                      packageName: 'dmg',
                      location: 'install',
                      version: versions.dmg,
                    })}
                  >
                    macOS build
                  </a>
                </>
              ) : (
                <a
                  href={urls.appimage}
                  data-download
                  {...downloadTrack({
                    os: 'linux',
                    packageName: 'appimage',
                    location: 'install',
                    version: versions.appimage,
                  })}
                >
                  Linux build
                </a>
              )}
            </p>
            {platform === 'mac' ? (
              <p className="installBrew">
                <span className="installDim">or with Homebrew</span> <code>{SITE.brew}</code>{' '}
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-live="polite"
                  {...trackAttributes({
                    event: 'copy_install_command',
                    params: { install_method: 'brew' },
                  })}
                >
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
              </p>
            ) : null}
            <p className="installAlt">
              Not ready to install?{' '}
              <a
                href={SITE.demo}
                {...trackAttributes({ event: 'demo_click', params: { cta_location: 'install' } })}
              >
                Try the live demo
              </a>{' '}
              in your browser.
            </p>
          </div>
          <div className="onlyCoarse">
            <StarButton location="install" />
            <p className="installAlt">
              Goodboy runs on macOS and Linux. Star it now and find it on your computer later.
            </p>
          </div>
          <a className="installFeatures" href={SITE.features}>
            Explore the features
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <ol className="installSteps" data-reveal="">
          <li>
            <b>Download</b>
            <span className="onlyFine">{step}</span>
            <span className="onlyCoarse">On your Mac or Linux computer.</span>
          </li>
          <li>
            <b>Sign in to a provider</b>
            <span>Claude, Codex, Cursor, Gemini and more. Use the plans you already pay for.</span>
          </li>
          <li>
            <b>New workspace</b>
            <span>
              Pick a repo you work on. Your first task starts from an issue or a sentence.
            </span>
          </li>
        </ol>
        <p className="installBug" data-reveal="">
          Found a bug? Report it from the app, or{' '}
          <a href={SITE.newIssue}>open an issue on GitHub</a>.
        </p>
      </div>
    </Chapter>
  );
};
