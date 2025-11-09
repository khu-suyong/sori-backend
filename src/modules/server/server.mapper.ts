import type { Server as PrismaServer } from '@prisma/client';

import type { PublicServer, Server } from './server.schema';

export const toPublicServer = (server: Server | PrismaServer): PublicServer => {
  return {
    id: server.id,
    name: server.name,
    url: server.url,
  };
};
