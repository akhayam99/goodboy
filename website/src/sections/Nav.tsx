import './Nav.css';
import { BrandMark } from '../components/BrandIcons';
import { Logo } from '../components/Logo';
import { NavMenu, type NavMenuLink } from '../components/NavMenu';
import { ThemeToggle } from '../components/ThemeToggle';
import { useDownloads } from '../hooks/useDownloads';
import { useScrolled } from '../hooks/useScrolled';
import { SITE } from '../site';

const NAV_LINKS: readonly NavMenuLink[] = [
  { label: 'How it works', href: SITE.howItWorks },
  { label: 'Features', href: SITE.features },
  { label: 'Changelog', href: SITE.changelog },
];

const isCurrent = (href: string) =>
  typeof window !== 'undefined' && href.startsWith('/features')
    ? window.location.pathname.replace(/\/$/, '') === '/features'
    : false;

export const Nav = () => {
  const isScrolled = useScrolled();
  const { primary } = useDownloads();
  const menuLinks = NAV_LINKS.map((link) => ({ ...link, isCurrent: isCurrent(link.href) }));

  return (
    <header className={isScrolled ? 'nav scrolled' : 'nav'} id="top">
      <div className="shell">
        <div className="navInner">
          <Logo />
          <nav className="navLinks" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <span className="navSpacer" />
          <div className="navActions">
            <a className="iconButton navGithub" href={SITE.repo} aria-label="Goodboy on GitHub">
              <BrandMark brand="github" size={18} />
            </a>
            <ThemeToggle />
            <a className="btn small onlyFine" href={primary.href} data-download>
              {primary.label}
            </a>
          </div>
          <NavMenu links={menuLinks} />
        </div>
      </div>
    </header>
  );
};
