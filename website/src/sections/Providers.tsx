import './Providers.css';
import { BrandMark, PROVIDERS } from '../components/BrandIcons';

export const Providers = () => (
  <section className="providers" aria-label="Providers">
    <div className="shell">
      <ul className="providerRow">
        <li className="providerLead">Works with</li>
        {PROVIDERS.map((provider) => (
          <li key={provider.id} className="provider">
            <BrandMark brand={provider.id} size={16} />
            {provider.name}
          </li>
        ))}
      </ul>
    </div>
  </section>
);
