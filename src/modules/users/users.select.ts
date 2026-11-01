import type { Prisma } from '../../generated/prisma/client';

/** User fields that are safe to return to clients. Add new columns here deliberately. */
export const publicUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  supabaseUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof publicUserSelect;
}>;
