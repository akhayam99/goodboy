import './ProviderLine.css';
import { BrandMark, PROVIDERS } from './BrandIcons';

export const ProviderLine = () => (
  <div className="providerLine" data-works-with>
    <p className="providerLineLabel" id="provider-line-label">
      Works with
    </p>
    <ul className="providerLineList" aria-labelledby="provider-line-label">
      {PROVIDERS.map((provider) => (
        <li key={provider.id} className="providerLineItem">
          <BrandMark brand={provider.id} size={16} isBrandColored />
          {provider.name}
        </li>
      ))}
    </ul>
  </div>
);
