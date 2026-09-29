import './Closer.css';
import { Statement } from '../components/Statement';

export const Closer = () => (
  <section className="closer" aria-labelledby="closer-title">
    <div className="shell">
      <Statement headingId="closer-title" heading={'Stop re‑explaining yourself'} isCentered />
    </div>
  </section>
);
