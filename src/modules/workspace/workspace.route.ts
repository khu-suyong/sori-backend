import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { PublicWorkspaceSchema } from './workspace.schema';
import { fetchWorkspaces } from './workspace.service';
import { toPublicWorkspace } from './workspace.mapper';

import { PaginationQuerySchema, PaginationSchema } from '../common/common.schema';
import { jwt } from '../../lib/jwt';

const getWorkspaceRoute = createRoute({
  method: 'get',
  path: '/',
  description: '현재 유저의 워크스페이스를 모두 조회합니다.',
  tags: ['Workspace'],
  summary: '워크스페이스 조회',
  request: {
    query: PaginationQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PaginationSchema(PublicWorkspaceSchema),
        },
      },
      description: '요청한 유저의 워크스페이스 목록.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});

const workspace = new OpenAPIHono();
workspace.use('*', jwt());

workspace.openapi(getWorkspaceRoute, async (c) => {
  const userId = c.get('userId');

  const { limit, cursor, sortBy, orderBy } = c.req.valid('query');

  const workspaces = await fetchWorkspaces(c.var.prisma, userId, {
    limit,
    cursor,
    sortBy,
    orderBy,
  });
  const previous = workspaces.length > 0 ? workspaces[0].id : null;
  const next = workspaces.length === limit ? workspaces[limit - 1].id : null;

  return c.json({
    items: workspaces.map(toPublicWorkspace),
    meta: { previous, next },
  }, 200);
});

export { workspace };
