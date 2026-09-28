import { BrandMark, type BrandId } from './BrandIcons';

export type Tool = {
  readonly brand: BrandId;
  readonly name: string;
  readonly use?: string;
};

type Props = {
  readonly label: string;
  readonly items: readonly Tool[];
};

export const ToolRow = ({ label, items }: Props) => (
  <div className="toolGroup">
    <h3>{label}</h3>
    <ul className="toolRow" aria-label={label}>
      {items.map((tool) => (
        <li key={tool.brand}>
          <BrandMark brand={tool.brand} size={18} />
          <span>
            {tool.name}
            {tool.use === undefined ? null : <small>{tool.use}</small>}
          </span>
        </li>
      ))}
    </ul>
  </div>
);
