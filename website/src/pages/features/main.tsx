import { mountRoot } from '../../lib/mountRoot';
import { FeaturesPage } from './FeaturesPage';
import '../../styles/base.css';
import '../../styles/consent.css';

mountRoot({ container: document.getElementById('root')!, children: <FeaturesPage /> });
