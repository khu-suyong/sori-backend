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

export type ExceptionBody = z.infer<typeof ExceptionBodySchema>;
export const ExceptionBodySchema = z.object({
  code: z.string(),
  message: z.string().optional(),
}).openapi('Exception');
