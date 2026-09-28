import { SITE } from '../site';

export const Closer = () => (
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
);
