import './Install.css';
import { CopyCommand } from '../components/CopyCommand';
import { Eyebrow } from '../components/Eyebrow';
import { StarCta } from '../components/StarCta';
import { revealStyle } from '../components/revealStyle';
import { INSTALL_FACTS } from '../data/installFacts';
import { SITE } from '../site';

export const Install = () => (
  <section className="installSection" id="install" aria-labelledby="install-title">
    <div className="shell">
      <div className="installInner">
        <div className="installHead">
          <div className="installTitle">
            <Eyebrow text="Install" kind="page" />
            <h2 id="install-title" className="beatHeading">
              Set up with a folder and a provider
            </h2>
          </div>
          <div className="installBody">
            <p className="installLead onlyFine" data-reveal style={revealStyle({ index: 0 })}>
              Download the app, sign in to a tool you already pay for, and point it at code you work
              on.
            </p>
            <p className="installLead onlyCoarse">
              Goodboy is a desktop app. Open <span className="nowrap">goodboy-ai.dev</span> on your
              Mac or Linux computer to install it.
            </p>
            <div className="installDesk onlyFine" data-reveal style={revealStyle({ index: 1 })}>
              <CopyCommand command={SITE.brew} />
              <div className="ctaRow">
                <a className="btn" href={SITE.latest} data-download>
                  Download for macOS
                </a>
                <a className="btn ghost" href={SITE.linux} data-download>
                  Linux builds
                </a>
              </div>
            </div>
            <StarCta />
          </div>
        </div>
        <ul className="installFacts">
          {INSTALL_FACTS.map((fact, index) => (
            <li key={fact} data-reveal style={revealStyle({ index })}>
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
);
