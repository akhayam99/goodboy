import { GitBranch } from 'lucide-react';
import { ICON_SIZE, TEXT_ROLE } from '@goodboy/ui';
import { Frame } from './Frame';
import { Section } from './Section';
import { ROW_HEIGHTS } from './rowHeights';

type GapStep = {
  readonly px: number;
  readonly token: string;
  readonly gap: string;
  readonly use: string;
};

const GAP_STEPS: ReadonlyArray<GapStep> = [
  { px: 4, token: 'gap-1', gap: 'gap-1', use: 'icon and label' },
  { px: 8, token: 'gap-2', gap: 'gap-2', use: 'controls in a row' },
  { px: 12, token: 'gap-3', gap: 'gap-3', use: 'rows in a list' },
  { px: 16, token: 'gap-4', gap: 'gap-4', use: 'related blocks' },
  { px: 24, token: 'gap-6', gap: 'gap-6', use: 'sections' },
  { px: 32, token: 'gap-8', gap: 'gap-8', use: 'page regions' },
];

const ICON_RUNGS = [
  { token: 'ICON_SIZE.mark', size: ICON_SIZE.mark, use: 'inside a chip or a dot' },
  { token: 'ICON_SIZE.row', size: ICON_SIZE.row, use: 'leading glyph in a row' },
  { token: 'ICON_SIZE.control', size: ICON_SIZE.control, use: 'buttons and triggers' },
  { token: 'ICON_SIZE.hero', size: ICON_SIZE.hero, use: 'empty states and headers' },
] as const;

const ROLE_SAMPLES = [
  { role: 'label', sample: 'Fix posting rounding in ledger-core' },
  { role: 'secondary', sample: 'Harborline, 3 steps, 2m' },
  { role: 'hint', sample: 'updated 4h ago' },
] as const;

export const LaddersScene = () => (
  <Frame>
    <Section title="Icon ladder">
      <ul className="flex flex-col gap-2">
        {ICON_RUNGS.map((rung) => (
          <li key={rung.token} className="flex items-center gap-3 text-label">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-fill text-foreground">
              <GitBranch size={rung.size} aria-hidden />
            </span>
            <span className="w-40 shrink-0 text-code text-foreground">{rung.token}</span>
            <span className={`w-12 shrink-0 tabular-nums ${TEXT_ROLE.secondary}`}>
              {rung.size}px
            </span>
            <span className={TEXT_ROLE.hint}>{rung.use}</span>
          </li>
        ))}
      </ul>
    </Section>
    <Section title="Type roles">
      <ul className="flex flex-col gap-2">
        {ROLE_SAMPLES.map((entry) => (
          <li key={entry.role} className="flex items-baseline gap-3 text-label">
            <span className="w-40 shrink-0 text-code text-foreground">
              {`TEXT_ROLE.${entry.role}`}
            </span>
            <span className={TEXT_ROLE[entry.role]}>{entry.sample}</span>
          </li>
        ))}
        <li className="flex items-baseline gap-3 text-label">
          <span className="w-40 shrink-0 text-code text-foreground">TEXT_ROLE.disabled</span>
          <button type="button" disabled className={`text-label ${TEXT_ROLE.disabled}`}>
            Unavailable until the push lands
          </button>
        </li>
        <li className="flex items-baseline gap-3 text-label">
          <span className="w-40 shrink-0 text-foreground">Numbers</span>
          <span className="tabular-nums text-foreground">$12.40 · 1,284 tokens · 3m 07s · 92%</span>
        </li>
        <li className="flex items-baseline gap-3 text-label">
          <span className="w-40 shrink-0 text-foreground">Code only</span>
          <span className="font-mono text-code text-foreground">ak/fix-rounding a1b2c3d</span>
        </li>
      </ul>
    </Section>
    <Section title="Row scale">
      <ul className="flex flex-col gap-1">
        {ROW_HEIGHTS.map((row) => (
          <li
            key={row.px}
            className={`flex ${row.height} items-center gap-3 rounded-md bg-fill px-3 text-label text-foreground`}
          >
            <span className="w-16 shrink-0 text-code">{row.token}</span>
            <span className={`tabular-nums ${TEXT_ROLE.secondary}`}>{row.px}px</span>
          </li>
        ))}
      </ul>
    </Section>
    <Section title="Gap steps">
      <ul className="flex flex-col gap-2">
        {GAP_STEPS.map((step) => (
          <li key={step.px} className="flex items-center gap-3 text-label">
            <span className="w-16 shrink-0 text-code text-foreground">{step.token}</span>
            <span className={`w-12 shrink-0 tabular-nums ${TEXT_ROLE.secondary}`}>{step.px}px</span>
            <span className={`flex ${step.gap}`}>
              <span aria-hidden className="size-4 rounded-sm bg-primary" />
              <span aria-hidden className="size-4 rounded-sm bg-primary" />
            </span>
            <span className={TEXT_ROLE.hint}>{step.use}</span>
          </li>
        ))}
      </ul>
    </Section>
  </Frame>
);
