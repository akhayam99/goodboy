import './Install.css';
import { useEffect, useRef, useState } from 'react';
import { Chapter } from '../components/Chapter';
import { StarButton } from '../components/StarButton';
import { useDownloads } from '../hooks/useDownloads';
import { SITE } from '../site';

const COPIED_MS = 1500;

export const Install = () => {
  const { platform, urls, primary } = useDownloads();
  const step =
    platform === 'linux'
      ? 'An .AppImage, or a .deb or .rpm package.'
      : 'A .dmg for Apple silicon and Intel.';
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
        lead: 'Three steps, about five minutes.',
      }}
    >
      <div className="install">
        <div className="installCta" data-reveal="">
          <div className="onlyFine">
            <a className="btn installMain" href={primary.href} data-download>
              {primary.label}
            </a>
            <p className="installAlt">
              {platform === 'linux' ? (
                <>
                  Also as{' '}
                  <a href={urls.deb} data-download>
                    .deb
                  </a>{' '}
                  and{' '}
                  <a href={urls.rpm} data-download>
                    .rpm
                  </a>
                  .{' '}
                  <a href={urls.dmg} data-download>
                    macOS build
                  </a>
                </>
              ) : (
                <>
                  One app for Apple silicon and Intel.{' '}
                  <a href={urls.appimage} data-download>
                    Linux build
                  </a>
                </>
              )}
            </p>
            {platform === 'mac' ? (
              <p className="installBrew">
                <span className="installDim">or with Homebrew</span> <code>{SITE.brew}</code>{' '}
                <button type="button" onClick={handleCopy} aria-live="polite">
                  {isCopied ? 'Copied' : 'Copy'}
                </button>
              </p>
            ) : null}
          </div>
          <div className="onlyCoarse">
            <StarButton />
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
            <span>Claude, Codex, Cursor, Gemini and more. Your plan, your keys.</span>
          </li>
          <li>
            <b>Open a folder</b>
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
