import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from './ui';
import { useInView } from './Reveal';

/* Two-column editorial section: copy on one side, mockup on the other.
   Single-color title, eyebrow above. Reverse stacks the mockup to the left.
   The whole section scroll-reveals: copy first, mockup a beat later. */
export function Section({
  id,
  eyebrow,
  title,
  body,
  reverse,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  body: ReactNode;
  reverse?: boolean;
  children: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <section
      id={id}
      ref={ref}
      className={`reveal-group relative py-24 sm:py-28 ${inView ? 'is-visible' : ''}`}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div
          className={`grid items-center gap-14 lg:grid-cols-2 lg:gap-20 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
        >
          <div className="reveal min-w-0 max-w-lg">
            <Eyebrow>{eyebrow}</Eyebrow>
            <SectionTitle>{title}</SectionTitle>
            <div className="mt-5 max-w-prose text-pretty text-[16px] leading-[1.65] text-muted-foreground sm:text-[17px]">
              {body}
            </div>
          </div>
          <div className="reveal min-w-0" style={{ animationDelay: '140ms' }}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
