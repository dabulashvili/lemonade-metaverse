import { ArgsType, Field, registerEnumType } from 'type-graphql';

export enum SortOrderDirection {
  Asc = 'ASC',
  Desc = 'DESC'
}
registerEnumType(SortOrderDirection, { name: 'SortOrdrerDirection' });

@ArgsType()
export class SortArgs {
  @Field({ nullable: true })
  public orderBy?: string;

  @Field(() => SortOrderDirection, { defaultValue: SortOrderDirection.Asc })
  public orderDirection!: SortOrderDirection;
}
