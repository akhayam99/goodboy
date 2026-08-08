import { Logo } from '../components/Logo';
import { SITE } from '../site';

export const Footer = () => (
  <footer>
    <div className="wrap">
      <Logo size={22} />
      <span style={{ fontSize: 13, color: 'var(--gray6)' }}>MIT © Amin Khayam</span>
      <span className="right">
        <a href={SITE.repo}>GitHub</a>
        <a href={SITE.vision}>Vision</a>
        <a href={SITE.releases}>Releases</a>
      </span>
    </div>
  </footer>
);
