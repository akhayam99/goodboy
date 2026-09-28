import { Logo } from '../components/Logo';
import { SITE } from '../site';

export const Footer = () => (
  <footer id="footer" aria-label="Footer">
    <div className="wrap">
      <Logo />
      <span className="right">
        <a href={SITE.repo}>GitHub</a>
        <a href={SITE.concepts}>Concepts</a>
        <a href={SITE.releases}>Releases</a>
      </span>
    </div>
  </footer>
);
