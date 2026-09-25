import type { PrintMetaField } from './artifactMetaFields';

type Props = {
  readonly fields: ReadonlyArray<PrintMetaField>;
};

export const PrintMetaBlock = ({ fields }: Props) => (
  <dl className="print-meta">
    {fields.map((field) => (
      <div key={field.label}>
        <dt>{field.label}</dt>
        <dd>{field.value}</dd>
      </div>
    ))}
  </dl>
);
