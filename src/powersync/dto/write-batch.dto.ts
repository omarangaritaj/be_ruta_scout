import { z } from 'zod';

/** Operaciones que PowerSync sube desde la cola local del cliente. */
export const WRITE_OPS = ['PUT', 'PATCH', 'DELETE'] as const;

export const writeBatchSchema = z.object({
  ops: z.array(
    z.object({
      op: z.enum(WRITE_OPS),
      table: z.string().min(1),
      id: z.string().min(1),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
});

export type WriteBatchDto = z.infer<typeof writeBatchSchema>;
export type WriteOp = WriteBatchDto['ops'][number];
