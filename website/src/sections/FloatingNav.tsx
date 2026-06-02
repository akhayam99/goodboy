import { useEffect, useState } from 'react';
import { DogMascot } from '../components/DogMascot';

const links = [
  { href: '#sessions', label: 'Sessions' },
  { href: '#context', label: 'Context' },
  { href: '#studio', label: 'Workflow' },
  { href: '#github', label: 'GitHub' },
  { href: '#linear', label: 'Linear' },
  { href: '#compare', label: 'Compare' },
];

/* A floating navigation pill, apple.com-style. The top-of-page Nav scrolls
   away with the hero; once the user has scrolled past it, this pill fades in
   at top-center and stays put. Always-on-screen navigation without taking up
   header chrome on every scroll-stop.
*/
export function FloatingNav() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Threshold roughly equals the header height (h-14 = 56px) plus a buffer.
    // Below that, the original Nav is still visible; above, the pill takes
    // over.
    const threshold = 200;
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={[
        'pointer-events-none fixed left-1/2 top-3 z-40 -translate-x-1/2 transition-all duration-300',
        visible
          ? 'translate-y-0 opacity-100 motion-safe:pointer-events-auto'
          : '-translate-y-2 opacity-0',
      ].join(' ')}
    >
      <nav
        className={[
          'flex items-center gap-1 rounded-full border border-border-soft bg-background/85 px-1.5 py-1.5 shadow-lg backdrop-blur-md',
          // The pill scales the gap on wide viewports so the labels can breathe.
          'md:gap-2 md:px-2',
        ].join(' ')}
      >
        <a
          href="#"
          aria-label="Goodboy"
          className="flex size-7 items-center justify-center rounded-full text-primary hover:text-foreground"
        >
          <DogMascot size={18} />
        </a>

        <span aria-hidden className="hidden h-4 w-px bg-border-soft md:block" />

        <div className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-2.5 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <span aria-hidden className="hidden h-4 w-px bg-border-soft md:block" />

        <a
          href="https://github.com/akhayam99/goodboy"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-[oklch(0.78_0.11_200)]"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.32c-2.23.48-2.7-1.07-2.7-1.07-.37-.93-.9-1.18-.9-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.3-1.59.83-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
          </svg>
          <span>GitHub</span>
        </a>
      </nav>
    </div>
  );
}
