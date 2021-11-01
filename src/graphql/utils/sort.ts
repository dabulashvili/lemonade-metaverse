import { SortArgs, SortOrderDirection } from '../types/sort';

export const getSort = ({ orderBy, orderDirection }: SortArgs): Record<string, 1 | -1> => {
  if (!orderBy) return {};

  return { [orderBy]: orderDirection === SortOrderDirection.Asc ? 1 : -1 };
};
