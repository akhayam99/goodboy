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
        Yes. Goodboy is open source under the <B>MIT license</B>. It runs on the agent subscriptions
        and logins you already have.
      </>
    ),
  },
  {
    q: 'Do I need API keys?',
    a: (
      <>
        No, except OpenRouter. Goodboy drives the command-line tools you already installed and
        signed into: Claude, Cursor, Codex, Google (Antigravity), and OpenCode. OpenRouter runs
        through the <B>OpenCode runtime</B> on an API key you provide.
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
    q: 'Can I control what agents are allowed to do?',
    a: (
      <>
        Yes. Tool rules let you <B>allow, deny, or ask</B> for each tool, at global, workspace, or
        session scope. A blocked call surfaces in the transcript and you can approve it inline. The
        feature is in beta, enforced on Claude sessions first.
      </>
    ),
  },
  {
    q: 'Which platforms?',
    a: (
      <>
        <B>macOS today</B>, as a universal build or via Homebrew. Prebuilt binaries for Linux and
        Windows coming; you can build from source in the meantime, with a Rust toolchain.
      </>
    ),
  },
  {
    q: 'Is there a mobile app?',
    a: (
      <>
        Not a separate app. A <B>beta companion</B> pairs your phone with the desktop through a
        bridge: enough to spawn a workflow or merge a PR while you&apos;re away.
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

        <div className="reveal mt-12 flex flex-col" style={{ animationDelay: '100ms' }}>
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
