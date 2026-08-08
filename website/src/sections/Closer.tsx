import { delay } from '../components/Reveal';
import { SITE } from '../site';

export const Closer = () => (
  <section className="block closer" aria-labelledby="h2-close">
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
);
