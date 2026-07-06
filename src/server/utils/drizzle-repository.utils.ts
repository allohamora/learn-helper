import * as schema from '../db/db.schema';
import type { DBQueryConfig, ExtractTablesWithRelations } from 'drizzle-orm';
import { eq, inArray } from 'drizzle-orm';
import type { AnyPgTable, PgColumn } from 'drizzle-orm/pg-core';
import { RelationalQueryBuilder } from 'drizzle-orm/pg-core/query-builders/query';
import { db } from '../db/db.service';
import { Exception } from './exception.utils';

type Schema = ExtractTablesWithRelations<typeof schema>;

export type DrizzleRepositoryOptions<
  T extends AnyPgTable & { id: PgColumn },
  K extends keyof Schema,
  Q extends RelationalQueryBuilder<Schema, Schema[K]>,
> = {
  table: T;
  query: Q;
  relations?: DBQueryConfig<'many', true, Schema, Schema[K]>['with'];
};

export class DrizzleRepository<
  T extends AnyPgTable & { id: PgColumn },
  K extends keyof Schema,
  Q extends RelationalQueryBuilder<Schema, Schema[K]>,
> {
  private table: T;
  private query: Q;
  private relations: DBQueryConfig<'many', true, Schema, Schema[K]>['with'];

  constructor({ table, query, relations }: DrizzleRepositoryOptions<T, K, Q>) {
    this.table = table;
    this.query = query;
    this.relations = relations;
  }

  public async findManyByIds(ids: string[]) {
    return await this.query.findMany({ with: this.relations, where: inArray(this.table.id, ids) });
  }

  public async findOneById(id: string) {
    return await this.query.findFirst({ with: this.relations, where: eq(this.table.id, id) });
  }

  public async createOne(value: T['$inferInsert']) {
    const [result] = await db.insert(this.table).values(value).returning();
    if (!result) throw Exception.internalServer('failed to create');

    return result as T['$inferSelect'];
  }

  public async updateOneById(id: string, value: Partial<T['$inferInsert']>) {
    const [result] = (await db
      .update(this.table)
      .set(value)
      .where(eq(this.table.id, id))
      .returning()) as T['$inferSelect'][];
    if (!result) throw Exception.internalServer('failed to update');

    return result as unknown as T['$inferSelect'];
  }

  public async updateManyByIds(ids: string[], value: Partial<T['$inferInsert']>) {
    const result = (await db
      .update(this.table)
      .set(value)
      .where(inArray(this.table.id, ids))
      .returning()) as T['$inferSelect'][];

    return result as unknown as T['$inferSelect'][];
  }
}
