import { Logo } from '../components/Logo';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-border-soft/60 bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-6 sm:flex-row">
        <div className="flex items-center gap-4">
          <Logo size={22} />
          <span className="text-[12px] text-muted-foreground">© 2026 &middot; MIT licensed</span>
        </div>
        <nav className="flex items-center gap-5 text-[12.5px] text-muted-foreground">
          <a
            href="https://github.com/akhayam99/goodboy"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/company/goodboy-ai/"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            LinkedIn
          </a>
          <a href="#sessions" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#compare" className="transition-colors hover:text-foreground">
            Why Goodboy
          </a>
          <a href="#cta" className="transition-colors hover:text-foreground">
            Install
          </a>
          <span className="text-border" aria-hidden>
            &middot;
          </span>
          <a
            href="https://github.com/akhayam99/goodboy/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="font-mono transition-colors hover:text-foreground"
          >
            Docs
          </a>
        </nav>
      </div>
    </footer>
  );
}
