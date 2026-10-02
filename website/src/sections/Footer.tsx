import './Footer.css';
import { Logo } from '../components/Logo';
import { LATEST_VERSION } from '../data/latestVersion';
import { SITE } from '../site';

type FooterLink = {
  readonly label: string;
  readonly href: string;
  readonly className?: string;
};

type Column = {
  readonly title: string;
  readonly links: readonly FooterLink[];
};

const COLUMNS: readonly Column[] = [
  {
    title: 'Product',
    links: [
      { label: 'All features', href: SITE.features },
      { label: 'How it works', href: SITE.howItWorks },
      { label: 'Workflows', href: `${SITE.features}#workflows` },
      { label: 'Releases', href: SITE.releases },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Getting started', href: SITE.gettingStarted },
      { label: 'Concepts', href: SITE.featureGuide },
      { label: 'Providers', href: SITE.featureDoc('providers') },
      { label: 'Workflows guide', href: SITE.featureDoc('workflows') },
    ],
  },
  {
    title: 'Project',
    links: [
      { label: 'GitHub', href: SITE.repo },
      { label: 'Changelog', href: SITE.changelog },
      { label: 'Security', href: SITE.security },
      { label: 'Report a bug', href: SITE.newIssue },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: SITE.privacy },
      { label: 'Cookie policy', href: SITE.cookies },
      { label: 'Cookie settings', href: '#', className: 'iubenda-cs-preferences-link' },
    ],
  },
];

export const Footer = () => (
  <footer className="footer" aria-label="Footer">
    <div className="shell">
      <div className="footerInner">
        <div className="footerGrid">
          <div className="footerBrand">
            <Logo />
            <p>An agentic development environment for macOS and Linux.</p>
            <code>v{LATEST_VERSION}</code>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.title} className="footerColumn" aria-label={column.title}>
              <p className="footerTitle">{column.title}</p>
              {column.links.map((link) => (
                <a key={link.label} href={link.href} className={link.className}>
                  {link.label}
                </a>
              ))}
            </nav>
          ))}
        </div>
        <div className="footerLegal">
          <span>© {new Date().getFullYear()} Goodboy</span>
        </div>
      </div>
    </div>
  </footer>
);
