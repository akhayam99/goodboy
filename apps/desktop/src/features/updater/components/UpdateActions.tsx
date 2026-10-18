import { useUpdateCard } from '../hooks/useUpdateCard';
import { UpdateVerbButtons } from './UpdateVerbButtons';

export const UpdateActions = () => {
  const card = useUpdateCard();
  if (card.verbs.length === 0) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <UpdateVerbButtons verbs={card.verbs} />
    </span>
  );
};
