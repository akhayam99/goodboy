import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';

type Qa = {
  q: string;
  a: ReactNode;
};

const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
);

const ITEMS: ReadonlyArray<Qa> = [
  {
    q: 'Is it free?',
    a: (
      <>
        Yes. Goodboy is open source under the <B>MIT license</B>. You bring your own agent logins
        and plans.
      </>
    ),
  },
  {
    q: 'Do I need API keys?',
    a: (
      <>
        <B>No.</B> Goodboy drives the command-line tools you already installed and signed into:
        Claude, Cursor, Codex, and Gemini.
      </>
    ),
  },
  {
    q: 'Where do my credentials live?',
    a: (
      <>
        Your provider logins stay inside the CLI tools you already signed into. Any optional API key
        you add to Goodboy lives in your <B>OS keychain</B>, read at spawn and never written to
        disk.
      </>
    ),
  },
  {
    q: 'Does my code leave my machine?',
    a: (
      <>
        Goodboy itself is <B>local-first</B>: your sessions, history, and keys stay on your machine.
        The agents you run reach their own providers exactly as they do in your terminal.
      </>
    ),
  },
  {
    q: 'Which platforms?',
    a: (
      <>
        <B>macOS today</B>, as a universal build or via Homebrew. Linux and Windows are in progress;
        you can build from source in the meantime.
      </>
    ),
  },
];

const Chevron = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
    className="shrink-0 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180"
  >
    <path
      d="M4 6l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const Faq = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="faq"
      ref={ref}
      className={`reveal-group relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-2xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Questions</Eyebrow>
          <SectionTitle>Before you install</SectionTitle>
        </div>

        <div className="reveal mt-10 flex flex-col" style={{ animationDelay: '100ms' }}>
          {ITEMS.map((item) => (
            <details key={item.q} className="group border-t border-border-soft py-4 last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-[16px] font-medium text-foreground">{item.q}</span>
                <Chevron />
              </summary>
              <p className="mt-3 max-w-prose text-pretty text-[14.5px] leading-[1.6] text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
