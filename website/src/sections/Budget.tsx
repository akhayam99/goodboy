import { Eyebrow, SectionTitle } from '../components/ui';
import { useInView } from '../components/Reveal';
import { BudgetCaps } from '../mockups/BudgetCaps';

export const Budget = () => {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id="spend"
      ref={ref}
      className={`scene reveal-group relative ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto w-full max-w-4xl px-6">
        <div className="reveal max-w-2xl">
          <Eyebrow>Spend</Eyebrow>
          <SectionTitle>A cap per provider, checked before the turn</SectionTitle>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.65] text-muted-foreground">
            Set a monthly cap on each provider and a soft cap on a single session. Goodboy checks
            the budget when a turn spawns: under the cap it runs, over it the turn routes to another
            provider you have connected, and the card says so.
          </p>
        </div>

        <div className="reveal mt-8" style={{ animationDelay: '140ms' }}>
          <BudgetCaps />
        </div>
      </div>
    </section>
  );
};
