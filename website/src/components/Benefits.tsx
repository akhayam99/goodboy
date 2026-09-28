import './Benefits.css';
import type { ReactNode } from 'react';

export type Benefit = {
  readonly lead: string;
  readonly text: ReactNode;
};

type Props = {
  readonly items: readonly Benefit[];
};

export const Benefits = ({ items }: Props) => (
  <ul className="benefits">
    {items.map((item) => (
      <li key={item.lead}>
        <b>{item.lead}</b> {item.text}
      </li>
    ))}
  </ul>
);
