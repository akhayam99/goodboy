import './Support.css';
import { SITE } from '../site';

export const Support = () => (
  <section className="support" aria-label="Support">
    <div className="shell">
      <p className="supportRow">
        Found a bug? Report it from the app, or <a href={SITE.newIssue}>open an issue on GitHub</a>.
      </p>
    </div>
  </section>
);
