import { Logo } from '../components/Logo';

export function Footer() {
  return (
    <footer className="mt-8 border-t border-border-soft/60 bg-background py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-6 sm:flex-row">
        <div className="flex flex-col items-center gap-1.5 sm:items-start sm:gap-4">
          <Logo size={22} />
          <p className="max-w-sm text-[13px] text-muted-foreground leading-[1.5]">
            Goodboy holds the thread across every agent, so the goal, the plan, and the work stay in
            one place.
          </p>
          <span className="text-[12px] text-muted-foreground">© 2026 &middot; MIT licensed</span>
        </div>
        <nav className="flex flex-col items-center gap-3 text-[12.5px] text-muted-foreground sm:flex-row sm:gap-5">
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
          <a href="#solutions" className="transition-colors hover:text-foreground">
            Why Goodboy
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
          <a href="#cta" className="transition-colors hover:text-foreground">
            Install
          </a>
          <span className="hidden text-border sm:inline" aria-hidden>
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
          <span className="hidden text-border sm:inline" aria-hidden>
            &middot;
          </span>
          <a
            href="https://www.iubenda.com/privacy-policy/46359357"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Privacy Policy
          </a>
          <a
            href="https://www.iubenda.com/privacy-policy/46359357/cookie-policy"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Cookie Policy
          </a>
        </nav>
      </div>
    </footer>
  );
}
