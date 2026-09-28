import { useEffect, useRef, useState } from 'react';
import { SeeHow } from '../components/SeeHow';
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
      <section className="block alt" id="install" aria-labelledby="h2-install">
        <div className="wrap duo">
          <div className="duoText">
            <h2 id="h2-install">Setup is a folder and a provider</h2>
            <p className="sub">
              Install it on macOS or Linux, connect a provider, and point it at a folder you already
              work in.
            </p>
          </div>
          <div>
            <div className="cmd">
              <span className="p">$</span>
              <span>{SITE.brew}</span>
              <button id="copyBtn" type="button" onClick={handleCopy}>
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <div className="ctaRow">
              <a className="btn" href={SITE.latest}>
                Download for macOS
              </a>
              <a className="btn ghost" href={SITE.linux}>
                Linux builds on the release page
              </a>
            </div>
            <p className="reassure">
              <b>No account, no waitlist. You are working in about five minutes.</b>
            </p>
            <p className="reassure">
              Try it and break it. <b>&quot;This feels off&quot; is a valid bug report.</b> Press ⌘I
              in the app to file one in a line, or <a href={SITE.issues}>open an issue →</a>
            </p>
            <SeeHow anchor="set-up" />
          </div>
        </div>
      </section>
      <section className="block closer" aria-labelledby="h2-close">
        <div className="wrap">
          <h2 id="h2-close">
            Ready to stop <span className="nobr">re-explaining</span> yourself?
          </h2>
          <div className="ctaRow center">
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
