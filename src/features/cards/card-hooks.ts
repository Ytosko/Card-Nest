import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCard, listCards, listTags, searchCards, toggleFavorite } from './card-service';

export const cardKeys = {
  all: ['cards'] as const,
  detail: (id: string) => ['cards', id] as const,
  search: (query: string) => ['cards', 'search', query] as const,
  tags: ['tags'] as const,
};

export function useCards() {
  return useQuery({ queryKey: cardKeys.all, queryFn: () => listCards() });
}

export function useTags() {
  return useQuery({ queryKey: cardKeys.tags, queryFn: listTags });
}

export function useCard(cardId: string) {
  return useQuery({ queryKey: cardKeys.detail(cardId), queryFn: () => getCard(cardId), enabled: Boolean(cardId) });
}

export function useCardSearch(query: string) {
  return useQuery({ queryKey: cardKeys.search(query), queryFn: () => searchCards(query), enabled: query.trim().length > 0 });
}

export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, isFavorite }: { cardId: string; isFavorite: boolean }) => toggleFavorite(cardId, isFavorite),
    onSuccess: async (_, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: cardKeys.all }),
        client.invalidateQueries({ queryKey: cardKeys.detail(variables.cardId) }),
      ]);
    },
  });
}
