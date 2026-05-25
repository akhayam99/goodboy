import { Logo } from '../components/Logo';

const links = [
  { href: '#features', label: 'Features' },
  { href: '#routing', label: 'Routing' },
  { href: '#plans', label: 'Plans' },
  { href: '#stack', label: 'Stack' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[oklch(0.20_0.006_255_/_0.7)] border-b border-[oklch(0.36_0.012_255_/_0.5)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <a href="#" className="flex items-center">
          <Logo />
        </a>
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] text-[oklch(0.78_0.01_255)] hover:text-[oklch(0.95_0.005_90)] transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="#cta"
            className="hidden sm:inline-flex text-[13px] text-[oklch(0.78_0.01_255)] hover:text-[oklch(0.95_0.005_90)] transition-colors"
          >
            Install
          </a>
          <a
            href="https://github.com/akhayam99/goodboy"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[oklch(0.78_0.13_200)] px-3.5 py-1.5 text-[13px] font-medium text-[oklch(0.13_0.02_200)] hover:bg-[oklch(0.82_0.13_200)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
            </svg>
            GitHub
          </a>
        </div>
      </div>
    </header>
  );
}
