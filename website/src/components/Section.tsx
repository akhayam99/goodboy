import type { ReactNode } from 'react';
import { Eyebrow, SectionTitle } from './ui';

/* Two-column editorial section: copy on one side, mockup on the other.
   Single-color title, eyebrow above. Reverse stacks the mockup to the left.
*/
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
  return (
    <section id={id} className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div
          className={`grid items-center gap-14 lg:grid-cols-2 lg:gap-20 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
        >
          <div className="max-w-lg">
            <Eyebrow>{eyebrow}</Eyebrow>
            <SectionTitle>{title}</SectionTitle>
            <div className="mt-6 max-w-prose space-y-4 text-[15px] leading-[1.7] text-muted-foreground">
              {body}
            </div>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
