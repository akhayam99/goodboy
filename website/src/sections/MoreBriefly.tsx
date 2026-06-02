import { Eyebrow } from '../components/ui';
import { useInView } from '../components/Reveal';

/* The sixth "point": everything else, kept deliberately dry. One line each,
   no mockups. The five sections above carry the weight; this is the tail. */
const ITEMS: ReadonlyArray<{ k: string; v: string }> = [
  {
    k: 'Costs',
    v: 'Each task goes to the right model, and Goodboy gives you a heads-up before you burn Opus on a one-liner. Every session shows its cost in real time.',
  },
  {
    k: 'Seven agents',
    v: 'Scout, plan, implement, debug, test, review, docs: each agent sticks to its role and no one steps into someone else’s job.',
  },
  {
    k: 'Plans',
    v: 'Agents write the plan before touching your code. It stays in place: you can easily read and edit it. It’s not a message that scrolls away.',
  },
  {
    k: 'Local-first',
    v: 'Runs on your machine, with your keys and data. Just use the subscription you already have.',
  },
  {
    k: 'Open source',
    v: 'MIT licensed, fully open. Try it, break it, send feedback.',
  },
];

export function MoreBriefly() {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      ref={ref}
      className={`reveal-group relative py-20 sm:py-24 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>06 &middot; Everything else</Eyebrow>
          <p className="mt-4 text-pretty text-[16px] leading-[1.6] text-muted-foreground sm:text-[17px]">
            The stuff that matters, kept short.
          </p>
        </div>
        <dl
          className="reveal mt-8 grid gap-x-12 gap-y-7 sm:grid-cols-2 lg:grid-cols-3"
          style={{ animationDelay: '120ms' }}
        >
          {ITEMS.map((it) => (
            <div key={it.k} className="border-t border-border-soft pt-3.5">
              <dt className="text-[15px] font-semibold text-foreground">{it.k}</dt>
              <dd className="mt-1.5 text-pretty text-[13.5px] leading-[1.6] text-muted-foreground">
                {it.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
