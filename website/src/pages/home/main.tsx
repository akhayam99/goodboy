import { HomePage } from './HomePage';
import { FidelityView } from '../../components/FidelityView';
import { mountRoot } from '../../lib/mountRoot';
import '../../styles/base.css';
import '../../styles/consent.css';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme');
if (theme === 'dark' || theme === 'light') {
  document.documentElement.dataset.theme = theme;
}

const mock = params.get('fidelity');

if (mock !== null) {
  document.getElementById('root')?.replaceChildren();
}

mountRoot({
  children: mock === null ? <HomePage /> : <FidelityView mock={mock} />,
});
