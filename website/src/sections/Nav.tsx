import { Logo } from '../components/Logo';
import { SITE } from '../site';

export const Nav = () => (
  <header id="top">
    <div className="wrap">
      <Logo />
      <span className="vtag">{SITE.version}</span>
      <nav aria-label="Primary">
        <a className="hidesm" href="#how">
          How it works
        </a>
        <a className="hidesm" href="#integrations">
          Integrations
        </a>
        <a className="hidesm" href="#routing">
          Routing
        </a>
        <a className="hidesm" href="#privacy">
          Privacy
        </a>
        <a href={SITE.repo}>GitHub</a>
        <a className="btn small" href="#install">
          Install
        </a>
      </nav>
    </div>
  </header>
);
