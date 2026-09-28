import './Install.css';
import { useEffect, useRef, useState } from 'react';
import { Chapter } from '../components/Chapter';
import { SITE } from '../site';

const COPIED_MS = 1500;

export const Install = () => {
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
      head={{
        eyebrow: 'Install',
        eyebrowKind: 'page',
        heading: 'Set up with a folder and a provider',
        lead: 'Download the app, sign in to a tool you already pay for, and point it at code you work on.',
      }}
    >
      <div className="install">
        <div className="cmd">
          <span className="cmdPrompt" aria-hidden="true">
            $
          </span>
          <code>{SITE.brew}</code>
          <button type="button" onClick={handleCopy}>
            {isCopied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="ctaRow">
          <a className="btn" href={SITE.latest}>
            Download for macOS
          </a>
          <a className="btn ghost" href={SITE.linux}>
            Linux builds
          </a>
        </div>
        <p className="installNote">Most people are working in five minutes.</p>
      </div>
    </Chapter>
  );
};
