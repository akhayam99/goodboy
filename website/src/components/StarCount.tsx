import './StarCount.css';
import { STARS } from '../data/formatStars';

export const StarCount = () => (STARS === null ? null : <span className="starCount">{STARS}</span>);
