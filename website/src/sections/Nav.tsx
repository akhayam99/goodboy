import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { SITE } from '../site';

export const Nav = () => (
  <header id="top">
    <div className="wrap">
      <Logo />
      <nav aria-label="Primary">
        <div className="navLinks">
          <a className="hidesm" href="#how">
            How it works
          </a>
          <a className="hidesm" href="#developers">
            Developers
          </a>
          <a className="hidesm" href="#leads">
            Leads
          </a>
          <a className="hidesm" href="#integrations">
            Integrations
          </a>
          <a className="hidesm" href="#privacy">
            Privacy
          </a>
          <a href={SITE.repo}>GitHub</a>
        </div>
        <div className="navActions">
          <ThemeToggle />
          <a className="btn small" href="#install">
            Install
          </a>
        </div>
      </nav>
    </div>
  </header>
);
