import type { Prisma, PrismaClient } from '@prisma/client';

import type { CreatableServer, EditableServer } from './server.schema';

import type { PaginationQuery } from '../common/common.schema';

type GetServerId = { id: string; userId?: string; } | { name: string; userId: string; };
export const getServer = async (prisma: Prisma.TransactionClient, id: GetServerId) => {
  if ('name' in id) {
    return prisma.server.findFirst({
      where: {
        name: id.name,
        userId: id.userId,
      },
    });
  }

  return prisma.server.findUnique({
    where: {
      id: id.id,
      userId: id.userId,
    },
  });
};

type GetServersOptions = PaginationQuery;
export const getServers = async (
  prisma: Prisma.TransactionClient,
  userId: string,
  options: GetServersOptions = {},
) => {
  const { cursor, limit = 20, orderBy = 'desc', sortBy = 'createdAt' } = options;

  if (cursor) {
    return prisma.server.findMany({
      where: { userId },
      take: limit,
      skip: 1,
      cursor: { id: cursor },
      orderBy: { [sortBy]: orderBy },
    });
  }

  return prisma.server.findMany({
    where: { userId },
    orderBy: { [sortBy]: orderBy },
  });
};

export const createServer = async (prisma: PrismaClient, userId: string, input: CreatableServer) => {
  return prisma.$transaction(async (tx) => {
    const exists = await getServer(tx, { userId, name: input.name });
    if (exists) return 'already_exists';

    const server = await tx.server.create({
      data: {
        userId,
        ...input,
      },
    });

    return server;
  });
};

export const updateServer = async (
  prisma: PrismaClient,
  userId: string,
  serverId: string,
  input: EditableServer,
) => {
  return prisma.$transaction(async (tx) => {
    const exists = await getServer(tx, { id: serverId });
    if (!exists) return 'not_found';
    if (exists.userId !== userId) return 'no_permission';

    return tx.server.update({
      where: { id: serverId },
      data: {
        ...input,
      },
    });
  });
};

export const deleteServer = async (
  prisma: PrismaClient,
  userId: string,
  serverId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const exists = await getServer(tx, { id: serverId });
    if (!exists) return 'not_found';
    if (exists.userId !== userId) return 'no_permission';

    return tx.server.delete({ where: { id: serverId } });
  });
};
