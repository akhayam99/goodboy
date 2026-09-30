import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type WhatGoodboyCanDoLine = {
  readonly icon: ReactNode;
  readonly text: string;
};

type Props = {
  readonly title: string;
  readonly lines: ReadonlyArray<WhatGoodboyCanDoLine>;
  readonly footnote?: string;
};

export const WhatGoodboyCanDo = ({ title, lines, footnote }: Props) => (
  <section
    aria-label={title}
    className="flex min-w-0 flex-col gap-2 rounded-md border border-border-soft bg-subtle p-3"
  >
    <Eyebrow label={title} />
    <ul className="flex min-w-0 flex-col gap-1.5">
      {lines.map((line) => (
        <li
          key={line.text}
          className="flex min-w-0 items-start gap-2 text-secondary text-foreground"
        >
          <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground">
            {line.icon}
          </span>
          <span className="min-w-0">{line.text}</span>
        </li>
      ))}
    </ul>
    {footnote != null && <p className="text-secondary text-muted-foreground">{footnote}</p>}
    <p className="flex items-center gap-1.5 text-secondary text-faint-foreground">
      <Lock size={ICON_SIZE.row} aria-hidden />
      Stored in your Mac&apos;s keychain. Goodboy has no servers.
    </p>
  </section>
);
