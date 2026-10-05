import './Nav.css';
import { BrandMark } from '../components/BrandIcons';
import { Logo } from '../components/Logo';
import { NavMenu, type NavMenuLink } from '../components/NavMenu';
import { ThemeToggle } from '../components/ThemeToggle';
import { useScrolled } from '../hooks/useScrolled';
import { SITE } from '../site';

export type NavSection = 'home' | 'features' | 'docs' | 'changelog' | 'none';

type NavLink = {
  readonly label: string;
  readonly href: string;
  readonly section: NavSection;
};

type Props = {
  readonly current: NavSection;
};

const NAV_LINKS: readonly NavLink[] = [
  { label: 'How it works', href: SITE.howItWorks, section: 'none' },
  { label: 'Features', href: SITE.features, section: 'features' },
  { label: 'Docs', href: SITE.docs, section: 'docs' },
  { label: 'Changelog', href: SITE.changelog, section: 'changelog' },
];

export const Nav = ({ current }: Props) => {
  const isScrolled = useScrolled();
  const menuLinks: readonly NavMenuLink[] = NAV_LINKS.map((link) => ({
    label: link.label,
    href: link.href,
    isCurrent: link.section !== 'none' && link.section === current,
  }));

  return (
    <header className={isScrolled ? 'nav scrolled' : 'nav'} id="top">
      <div className="shell">
        <div className="navInner">
          <Logo />
          <nav className="navLinks" aria-label="Primary">
            {menuLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={link.isCurrent === true ? 'page' : undefined}
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
          </div>
          <NavMenu links={menuLinks} />
        </div>
      </div>
    </header>
  );
};
