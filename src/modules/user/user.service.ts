import type { Prisma, PrismaClient } from '@prisma/client'
import type { CreatableAccount, CreatableUser, EditableUser } from './user.schema';

type FetchIdOptions = { email: string; } | { id: string; };
type FetchUserOptions = {
  withProvider?: string;
};
export const fetchUser = async (db: Prisma.TransactionClient, input: FetchIdOptions, { withProvider }: FetchUserOptions = {}) => {
  const user = await db.user.findUnique({
    where: {
      id: 'id' in input ? input.id : undefined,
      email: 'email' in input ? input.email : undefined,
      accounts: withProvider ? {
        some: {
          provider: withProvider
        },
      } : undefined,
    },
  });

  return user;
};

export const updateUser = async (db: PrismaClient, id: FetchIdOptions, input: EditableUser) => {
  return db.$transaction(async (tx) => {
    const target = await fetchUser(tx, id);
    if (!target) return null;

    const user = await tx.user.update({
      where: {
        id: target.id,
      },
      data: {
        name: input.name,
        image: input.image,
      },
    });

    return user;
  });
};

export const putUser = async (db: PrismaClient, input: CreatableUser, account: CreatableAccount | null = null) => {
  return db.$transaction(async (tx) => {
    const id = { email: input.email };
    const user = await fetchUser(tx, id, { withProvider: account?.provider });
    if (user) return user;

    if (account) {
      const userExists = await fetchUser(tx, id);

      if (userExists) {
        const user = await tx.user.update({
          where: { email: input.email },
          data: {
            updatedAt: new Date(),
            accounts: {
              create: [
                {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  accessToken: account.accessToken,
                  refreshToken: account.refreshToken,
                  expiresAt: account.expiresAt,
                  scope: account.scope,
                },
              ],
            },
          },
        });

        return user;
      }
    }

    const result = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        image: input.image,
        accounts: account ? {
          create: [
            {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              accessToken: account.accessToken,
              refreshToken: account.refreshToken,
              expiresAt: account.expiresAt,
              scope: account.scope,
            },
          ],
        } : undefined,
      },
    });

    return result;
  });
};
