import { Logo } from '../components/Logo';
import { LinkButton } from '../components/ui';

const links = [
  { href: '#sessions', label: 'Sessions' },
  { href: '#context', label: 'Context' },
  { href: '#studio', label: 'Workflow Studio' },
  { href: '#github', label: 'GitHub Studio' },
  { href: '#linear', label: 'Linear Studio' },
  { href: '#compare', label: 'Compare' },
];

/* Top-of-page nav. Not sticky: scrolls away with the hero. The floating pill
   (FloatingNav.tsx) takes over once you scroll past it, in the same spirit as
   apple.com / linear.app / vercel.com.
*/
export function Nav() {
  return (
    <header className="relative z-30 border-b border-border-soft/40 bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#" className="flex items-center">
          <Logo />
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <LinkButton
          href="https://github.com/akhayam99/goodboy"
          target="_blank"
          rel="noreferrer"
          variant="primary"
          size="md"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
          </svg>
          GitHub
        </LinkButton>
      </div>
    </header>
  );
}
