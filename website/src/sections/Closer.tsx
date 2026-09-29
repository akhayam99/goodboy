import './Closer.css';
import { Statement } from '../components/Statement';
import { StarButton } from '../components/StarButton';
import { SITE } from '../site';

export const Closer = () => (
  <section className="closer" aria-labelledby="closer-title">
    <div className="shell">
      <Statement headingId="closer-title" heading={'Stop re\u2011explaining yourself'} isCentered>
        <div className="ctaRow">
          <a className="btn onlyFine" href={SITE.latest} data-download>
            Download for macOS
          </a>
          <a className="btn ghost onlyFine" href={SITE.linux} data-download>
            Linux builds
          </a>
          <StarButton />
        </div>
      </Statement>
    </div>
  </section>
);
