import './Providers.css';
import { BrandMark, PROVIDERS } from '../components/BrandIcons';

const BeltCopy = () => (
  <div className="beltCopy">
    {PROVIDERS.map((provider) => (
      <span key={provider.id} className="provider">
        <BrandMark brand={provider.id} size={16} />
        {provider.name}
      </span>
    ))}
  </div>
);

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
    <div className="providerBelt" aria-hidden="true">
      <div className="beltTrack">
        <BeltCopy />
        <BeltCopy />
      </div>
    </div>
  </section>
);
