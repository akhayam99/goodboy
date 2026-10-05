import { App } from './App';
import { FidelityView } from './components/FidelityView';
import { mountRoot } from './mountRoot';
import './styles.css';
import './styles/consent.css';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme');
if (theme === 'dark' || theme === 'light') {
  document.documentElement.dataset.theme = theme;
}

const container = document.getElementById('root')!;
const mock = params.get('fidelity');

if (mock !== null) {
  container.replaceChildren();
}

mountRoot({
  container,
  children: mock === null ? <App /> : <FidelityView mock={mock} />,
});
