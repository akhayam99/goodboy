import { Logo } from '../components/Logo';

export function Footer() {
  return (
    <footer className="border-t border-[oklch(0.36_0.012_255_/_0.5)] py-10 mt-8">
      <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <Logo size={22} />
          <span className="text-[11.5px] text-[oklch(0.58_0.015_255)]">© 2026 · MIT licensed</span>
        </div>
        <nav className="flex items-center gap-5 text-[12px] text-[oklch(0.78_0.01_255)]">
          <a
            href="https://github.com/akhayam99/goodboy"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[oklch(0.95_0.005_90)]"
          >
            GitHub
          </a>
          <a href="#features" className="hover:text-[oklch(0.95_0.005_90)]">
            Features
          </a>
          <a href="#stack" className="hover:text-[oklch(0.95_0.005_90)]">
            Stack
          </a>
          <a href="#cta" className="hover:text-[oklch(0.95_0.005_90)]">
            Install
          </a>
          <span className="text-[oklch(0.45_0.015_255)]">·</span>
          <a
            href="https://github.com/akhayam99/goodboy/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[oklch(0.78_0.01_255)] hover:text-[oklch(0.95_0.005_90)]"
          >
            Docs
          </a>
        </nav>
      </div>
    </footer>
  );
}
