import z from 'zod';

export const Timestamp = z.date();
export const ID = z.string().regex(/^[a-z][a-z0-9]{23}$/);

export const BaseEntity = z.object({
  id: ID,
});
export const Entity = BaseEntity.extend({
  createdAt: Timestamp,
  updatedAt: Timestamp.nullable(),
});

//

export type ExceptionBody = z.infer<typeof ExceptionBodySchema>;
export const ExceptionBodySchema = z.object({
  code: z.string(),
  message: z.string().optional(),
}).openapi('Exception');

//

const PaginationMetaSchema = z.object({
  previous: ID.nullable().openapi({ description: '이전 페이지 커서' }),
  next: ID.nullable().openapi({ description: '다음 페이지 커서' }),
});
const SortSchema = z.object({
  by: z.string().openapi({ description: '정렬 기준 필드' }),
  order: z.enum(['asc', 'desc']).openapi({ description: '정렬 순서' }),
});
export const SortOrderSchema = z.enum(['asc', 'desc']).openapi({ description: '정렬 순서' });
export const PaginationSchema = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  items: itemSchema.array(),
  meta: PaginationMetaSchema,
  sort: SortSchema.optional(),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional().openapi({ description: '페이지네이션 커서' }),
  limit: z.coerce.number().min(1).max(100).default(20).optional().openapi({ description: '한 번에 가져올 워크스페이스 개수' }),
  sortBy: z.string().default('createdAt').optional().openapi({ description: '정렬 기준 필드' }),
  orderBy: z.enum(['asc', 'desc']).default('desc').optional().openapi({ description: '정렬 순서' }),
}).openapi('PaginationQuery');
