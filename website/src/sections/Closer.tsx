import './Closer.css';
import { Statement } from '../components/Statement';
import { SITE } from '../site';

export const Closer = () => (
  <section className="closer" aria-labelledby="closer-title">
    <div className="shell">
      <Statement headingId="closer-title" heading={'Stop re\u2011explaining yourself'} isCentered>
        <div className="ctaRow">
          <a className="btn" href={SITE.latest}>
            Download for macOS
          </a>
          <a className="btn ghost" href={SITE.linux}>
            Linux builds
          </a>
        </div>
      </Statement>
    </div>
  </section>
);
