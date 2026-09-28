import './Footer.css';
import { CookieSettings } from '../components/CookieSettings';
import { Logo } from '../components/Logo';
import { LATEST_VERSION } from '../data/latestVersion';
import { SITE } from '../site';

type FooterLink = {
  readonly label: string;
  readonly href: string;
};

type Column = {
  readonly title: string;
  readonly links: readonly FooterLink[];
  readonly hasCookieSettings?: boolean;
};

const COLUMNS: readonly Column[] = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'All features', href: '/features' },
      { label: 'Releases', href: SITE.releases },
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
    ],
    hasCookieSettings: true,
  },
];

export const Footer = () => (
  <footer className="footer" aria-label="Footer">
    <div className="shell">
      <div className="footerInner">
        <div className="footerTop">
          <div className="footerBrand">
            <Logo />
            <p>An agentic development environment for macOS and Linux.</p>
            <code>v{LATEST_VERSION}</code>
          </div>
          <div className="footerColumns">
            {COLUMNS.map((column) => (
              <nav key={column.title} className="footerColumn" aria-label={column.title}>
                <p className="footerTitle">{column.title}</p>
                {column.links.map((link) => (
                  <a key={link.label} className="footerLink" href={link.href}>
                    {link.label}
                  </a>
                ))}
                {column.hasCookieSettings === true ? <CookieSettings /> : null}
              </nav>
            ))}
          </div>
        </div>
        <p className="footerCopy">© {new Date().getFullYear()} Goodboy</p>
      </div>
    </div>
  </footer>
);
