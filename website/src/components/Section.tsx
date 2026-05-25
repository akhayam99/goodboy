import type { ReactNode } from 'react';

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
    <section id={id} className="py-28 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div
          className={`grid lg:grid-cols-2 gap-14 lg:gap-24 items-center ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}
        >
          <div className="max-w-lg">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[oklch(0.82_0.12_200)] pb-4">
              {eyebrow}
            </div>
            <h2 className="text-[36px] sm:text-[48px] tracking-[-0.025em] font-bold leading-[1.02]">
              {title}
            </h2>
            <div className="mt-6 text-[16px] text-[oklch(0.72_0.012_255)] leading-[1.65] space-y-4">
              {body}
            </div>
          </div>
          <div>{children}</div>
        </div>
      </div>
    </section>
  );
}
