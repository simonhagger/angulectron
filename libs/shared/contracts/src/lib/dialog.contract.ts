import { z } from 'zod';
import { requestEnvelope } from './request-envelope';

export const openFileDialogRequestSchema = requestEnvelope(
  z
    .object({
      title: z.string().optional(),
      filters: z
        .array(
          z.object({
            name: z.string().min(1),
            extensions: z.array(z.string().min(1)).min(1),
          }),
        )
        .optional(),
    })
    .strict(),
);

export const openFileDialogResponseSchema = z.object({
  canceled: z.boolean(),
  fileName: z.string().optional(),
  fileToken: z.string().optional(),
});

export type OpenFileDialogRequest = z.infer<typeof openFileDialogRequestSchema>;
export type OpenFileDialogResponse = z.infer<
  typeof openFileDialogResponseSchema
>;
