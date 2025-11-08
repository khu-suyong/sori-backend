import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { CreatableWorkspaceSchema, PublicWorkspaceSchema } from './workspace.schema';
import { createWorkspace, fetchWorkspace, fetchWorkspaces } from './workspace.service';
import { toPublicWorkspace } from './workspace.mapper';

import { ID, PaginationQuerySchema, PaginationSchema } from '../common/common.schema';
import { jwt } from '../../lib/jwt';
import { jsonError } from '../../lib/exception';

const workspace = new OpenAPIHono();
workspace.use('*', jwt());

const getWorkspacesRoute = createRoute({
  method: 'get',
  path: '/',
  description: '현재 유저의 워크스페이스를 모두 조회합니다.',
  tags: ['Workspace'],
  summary: '모든 워크스페이스 조회',
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
workspace.openapi(getWorkspacesRoute, async (c) => {
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

const createWorkspaceRoute = createRoute({
  method: 'post',
  path: '/',
  description: '워크스페이스를 생성합니다.',
  tags: ['Workspace'],
  summary: '워크스페이스 생성',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatableWorkspaceSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: PublicWorkspaceSchema,
        },
      },
      description: '생성된 워크스페이스의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
workspace.openapi(createWorkspaceRoute, async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const workspace = await createWorkspace(c.var.prisma, userId, body);
  if (!workspace) {
    throw jsonError(400, {
      code: 'workspace_already_exists',
      message: '이미 동일한 이름의 워크스페이스가 존재합니다.',
    });
  }

  return c.json(toPublicWorkspace(workspace), 201);
});

const getWorkspaceRoute = createRoute({
  method: 'get',
  path: '/{workspace_id}',
  description: '특정 워크스페이스를 조회합니다.',
  tags: ['Workspace'],
  summary: '워크스페이스 조회',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '조회할 워크스페이스의 ID' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicWorkspaceSchema,
        },
      },
      description: '요청한 워크스페이스 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
workspace.openapi(getWorkspaceRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id } = c.req.valid('param');

  const workspace = await fetchWorkspace(c.var.prisma, userId, workspace_id, true);
  if (!workspace) {
    throw jsonError(404, {
      code: 'workspace_not_found',
      message: '워크스페이스를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicWorkspace(workspace), 200);
});

export { workspace };
