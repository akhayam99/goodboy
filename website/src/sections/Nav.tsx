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
            <a href={SITE.featureGuide}>Features</a>
            <a href={SITE.releases}>Releases</a>
          </nav>
          <span className="navSpacer" />
          <a className="iconButton" href={SITE.repo} aria-label="Goodboy on GitHub">
            <BrandMark brand="github" size={18} />
          </a>
          <ThemeToggle />
          <a className="btn small onlyFine" href={SITE.latest} data-download>
            Download
          </a>
        </div>
      </div>
    </header>
  );
};
