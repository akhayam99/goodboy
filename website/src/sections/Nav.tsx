import './Nav.css';
import { BrandMark } from '../components/BrandIcons';
import { Logo } from '../components/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { useScrolled } from '../hooks/useScrolled';
import { SITE } from '../site';

export const Nav = () => {
  const isScrolled = useScrolled();

  return (
    <header className={isScrolled ? 'nav scrolled' : 'nav'} id="top">
      <div className="shell">
        <div className="navInner">
          <Logo />
          <nav className="navLinks" aria-label="Primary">
            <a href="/#how">How it works</a>
            <a href="/#teams">For teams</a>
            <a href="/#workflows">Workflows</a>
            <a href={SITE.featureGuide}>Docs</a>
          </nav>
          <span className="navSpacer" />
          <a className="iconButton navGithub" href={SITE.repo} aria-label="Goodboy on GitHub">
            <BrandMark brand="github" size={18} />
          </a>
          <ThemeToggle />
          <a className="btn small" href={SITE.latest}>
            Download
          </a>
        </div>
      </div>
    </header>
  );
};
