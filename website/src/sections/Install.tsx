import './Install.css';
import { useEffect, useRef, useState } from 'react';
import { delay } from '../components/Reveal';
import { SITE } from '../site';

export const Install = () => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const handleCopy = () => {
    if (typeof navigator === 'undefined' || navigator.clipboard == null) return;
    navigator.clipboard
      .writeText(SITE.brew)
      .then(() => {
        setCopied(true);
        if (timeoutRef.current != null) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <>
      <section className="block" id="install" aria-labelledby="h2-install">
        <div className="wrap">
          <div className="blockHead">
            <h2 className="rv" id="h2-install">
              Setup is a folder and a provider
            </h2>
            <p className="sub rv" style={delay(80)}>
              Install it, connect a provider you already pay for, and point it at a folder you
              already work in.
            </p>
          </div>
          <div className="instRow rv" style={delay(160)}>
            <div className="cmd">
              <span className="p">$</span>
              <span>{SITE.brew}</span>
              <button id="copyBtn" type="button" onClick={handleCopy}>
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <a className="btn" href={SITE.latest}>
              Download for macOS
            </a>
            <a className="btn ghost" href={SITE.linux}>
              Linux builds on the release page
            </a>
          </div>
          <p className="reassure rv" style={delay(200)}>
            <b>No account, no waitlist. You are working in about five minutes.</b>
          </p>
          <p className="reassure rv" style={delay(240)}>
            Try it and break it. <b>&quot;This feels off&quot; is a valid bug report.</b>{' '}
            <a href={SITE.issues}>Open an issue →</a>
          </p>
        </div>
      </section>
      <section className="block alt in-closer" aria-labelledby="h2-close">
        <div className="wrap">
          <h2 className="rv" id="h2-close">
            Ready to stop re-explaining yourself?
          </h2>
          <div className="ctaRow rv" style={delay(80)}>
            <a className="btn" href={SITE.latest}>
              Download for macOS
            </a>
            <a className="btn ghost" href={SITE.repo}>
              Star on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
};
