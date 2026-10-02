import './StarCount.css';
import { useStarCount } from '../hooks/useStarCount';

export const StarCount = () => {
  const label = useStarCount();
  if (label === null) {
    return null;
  }
  return <span className="starCount">{label}</span>;
};
