import { z } from "zod";

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/).max(1_398_102);
const id = z.string().uuid();

export const encryptedItemSchema = z.object({
  format: z.literal("password-vault-item"),
  version: z.literal(1),
  vaultId: id,
  itemId: id,
  revision: z.number().int().positive().max(2_147_483_647),
  cipher: z.object({
    name: z.literal("aes-256-gcm"),
    nonce: base64Url.length(16),
    tagBits: z.literal(128),
  }).strict(),
  ciphertext: base64Url.min(23),
}).strict();

export const updateItemSchema = z.object({
  expectedRevision: z.number().int().positive().max(2_147_483_646),
  item: encryptedItemSchema,
}).strict().superRefine((value, context) => {
  if (value.item.revision !== value.expectedRevision + 1) context.addIssue({ code: "custom", path: ["item", "revision"], message: "revision must increment exactly once" });
});

export const deleteItemSchema = z.object({ expectedRevision: z.number().int().positive().max(2_147_483_646) }).strict();

export type EncryptedItemInput = z.infer<typeof encryptedItemSchema>;
