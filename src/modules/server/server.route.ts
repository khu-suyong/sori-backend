import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { CreatableServerSchema, EditableServerSchema, PublicServerSchema } from './server.schema';

import { jwt } from '../../lib/jwt';
import { createServer, deleteServer, getServer, getServers, updateServer } from './server.service';
import { jsonError } from '../../lib/exception';
import { toPublicServer } from './server.mapper';
import { PaginationQuerySchema, PaginationSchema } from '../common/common.schema';

const server = new OpenAPIHono();
server.use('*', jwt());

const createServerRoute = createRoute({
  method: 'post',
  path: '/',
  description: '서버를 생성합니다.',
  tags: ['Server'],
  summary: '서버 생성',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatableServerSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: PublicServerSchema,
        },
      },
      description: '생성한 서버의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
server.openapi(createServerRoute, async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const checkURL = `${body.url.replace(/\/+$/, '')}/health`;

  let check = false;
  try {
    const response = await fetch(checkURL);
    check = response.status === 200;
  } catch { }

  if (!check) {
    throw jsonError(400, {
      code: 'invalid_server_url',
      message: '서버 URL이 유효하지 않거나, 서버가 응답하지 않습니다.',
    });
  }

  const server = await createServer(c.var.prisma, userId, body);
  if (server === 'already_exists') {
    throw jsonError(409, {
      code: 'server_already_exists',
      message: '이미 존재하는 서버입니다.',
    });
  }

  return c.json(toPublicServer(server), 201);
});

const getServersRoute = createRoute({
  method: 'get',
  path: '/',
  description: '서버 목록을 조회합니다.',
  tags: ['Server'],
  summary: '서버 목록 조회',
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PaginationSchema(PublicServerSchema),
        },
      },
      description: '요청한 서버의 목록.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
server.openapi(getServersRoute, async (c) => {
  const userId = c.get('userId');
  const query = c.req.valid('query');

  const servers = await getServers(c.var.prisma, userId, query);
  const previous = servers.length > 0 ? servers[0].id : null;
  const next = servers.length === query.limit ? servers[query.limit - 1].id : null;

  return c.json({
    items: servers.map(toPublicServer),
    meta: { previous, next },
  }, 200);
});

const getServerRoute = createRoute({
  method: 'get',
  path: '/{server_id}',
  description: '서버 정보를 조회합니다.',
  tags: ['Server'],
  summary: '서버 정보 조회',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicServerSchema,
        },
      },
      description: '요청한 서버의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
server.openapi(getServerRoute, async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('server_id');

  const server = await getServer(c.var.prisma, { id: serverId, userId });
  if (!server) {
    throw jsonError(404, {
      code: 'server_not_found',
      message: '서버를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicServer(server), 200);
});

const updateServerRoute = createRoute({
  method: 'patch',
  path: '/{server_id}',
  description: '서버 정보를 수정합니다.',
  tags: ['Server'],
  summary: '서버 정보 수정',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EditableServerSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicServerSchema,
        },
      },
      description: '수정된 서버의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
server.openapi(updateServerRoute, async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('server_id');
  const body = c.req.valid('json');

  const server = await updateServer(c.var.prisma, userId, serverId, body);
  if (server === 'no_permission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '권한이 없습니다.',
    });
  }
  if (server === 'not_found') {
    throw jsonError(404, {
      code: 'server_not_found',
      message: '서버를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicServer(server), 200);
});

const deleteServerRoute = createRoute({
  method: 'delete',
  path: '/{server_id}',
  description: '서버를 삭제합니다.',
  tags: ['Server'],
  summary: '서버 삭제',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EditableServerSchema,
        },
      },
    },
  },
  responses: {
    204: {
      description: '서버 삭제됨.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
server.openapi(deleteServerRoute, async (c) => {
  const userId = c.get('userId');
  const serverId = c.req.param('server_id');

  const server = await deleteServer(c.var.prisma, userId, serverId);
  if (server === 'no_permission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '권한이 없습니다.',
    });
  }
  if (server === 'not_found') {
    throw jsonError(404, {
      code: 'server_not_found',
      message: '서버를 찾을 수 없습니다.',
    });
  }

  return c.body(null, 204);
});

export { server };
