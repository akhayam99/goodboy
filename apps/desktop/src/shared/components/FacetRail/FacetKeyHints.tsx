import { Eyebrow, KbdPill } from '@goodboy/ui';

export type FacetKeyHint = {
  readonly keys: ReadonlyArray<string>;
  readonly label: string;
};

type Props = {
  readonly hints: ReadonlyArray<FacetKeyHint>;
};

export const FacetKeyHints = ({ hints }: Props) => (
  <div className="flex flex-col gap-1.5 px-2">
    <Eyebrow label="Keys" muted />
    <dl className="flex flex-col gap-1">
      {hints.map((hint) => (
        <div key={hint.label} className="flex items-center justify-between gap-2 text-secondary">
          <dt className="text-muted-foreground">{hint.label}</dt>
          <dd className="flex items-center gap-1">
            {hint.keys.map((key) => (
              <KbdPill key={key}>{key}</KbdPill>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  </div>
);
