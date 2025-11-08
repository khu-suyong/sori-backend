import type { PrismaClient } from '@prisma/client';
import type { PaginationQuery } from '../common/common.schema';

type FetchWorkspacesOptions = PaginationQuery;
export const fetchWorkspaces = async (prisma: PrismaClient, userId: string, options: FetchWorkspacesOptions = {}) => {
  const { cursor, limit = 20, orderBy = 'desc', sortBy = 'createdAt' } = options;

  if (cursor) {
    return prisma.workspace.findMany({
      where: { userId },
      take: limit,
      skip: 1,
      cursor: { id: cursor },
      orderBy: { [sortBy]: orderBy },
      include: {
        notes: true,
        folders: true,
      },
    });
  }

  return prisma.workspace.findMany({
    where: { userId },
    orderBy: { [sortBy]: orderBy },
    include: {
      notes: true,
      folders: true,
    },
  });
};
