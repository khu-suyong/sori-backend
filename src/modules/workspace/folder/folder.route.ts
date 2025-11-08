import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { CreatableFolderSchema, EditableFolderSchema, PublicFolderSchema } from './folder.schema';

import { ID } from '../../common/common.schema';
import { createFolder, deleteFolder, updateFolder } from './folder.service';
import { toPublicFolder } from './folder.mapper';
import { jsonError } from '../../../lib/exception';

const folder = new OpenAPIHono();

const createFolderRoute = createRoute({
  method: 'post',
  path: '/',
  description: '폴더를 생성합니다.',
  tags: ['Workspace'],
  summary: '폴더 생성',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '폴더를 생성할 워크스페이스의 ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreatableFolderSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: PublicFolderSchema,
        },
      },
      description: '생성된 폴더의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
folder.openapi(createFolderRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id } = c.req.valid('param');
  const body = c.req.valid('json');

  const folder = await createFolder(
    c.var.prisma,
    { userId, workspaceId: workspace_id },
    body,
  );

  if (folder === 'NoPermission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '해당 워크스페이스에 대한 권한이 없습니다.',
    });
  }

  return c.json(toPublicFolder(folder), 201);
});

const updateFolderRoute = createRoute({
  method: 'patch',
  path: '/{folder_id}',
  description: '폴더를 수정합니다.',
  tags: ['Workspace'],
  summary: '폴더 수정',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '수정할 폴더의 워크스페이스의 ID' }),
      'folder_id': ID.openapi({ description: '수정할 폴더의 ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: EditableFolderSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicFolderSchema,
        },
      },
      description: '수정된 폴더의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
folder.openapi(updateFolderRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id, folder_id } = c.req.valid('param');
  const body = c.req.valid('json');

  const folder = await updateFolder(
    c.var.prisma,
    {
      userId,
      workspaceId: workspace_id,
      folderId: folder_id,
    },
    body,
  );

  if (folder === 'NoPermission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '해당 워크스페이스에 대한 권한이 없습니다.',
    });
  }
  if (folder === 'NotFound') {
    throw jsonError(404, {
      code: 'folder_not_found',
      message: '수정할 폴더를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicFolder(folder), 200);
});

const deleteFolderRoute = createRoute({
  method: 'delete',
  path: '/{folder_id}',
  description: '폴더를 삭제합니다.',
  tags: ['Workspace'],
  summary: '폴더 삭제',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '삭제할 폴더의 워크스페이스의 ID' }),
      'folder_id': ID.openapi({ description: '삭제할 폴더의 ID' }),
    }),
  },
  responses: {
    204: {
      description: '폴더가 성공적으로 삭제됨.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
folder.openapi(deleteFolderRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id, folder_id } = c.req.valid('param');

  const result = await deleteFolder(
    c.var.prisma,
    {
      userId,
      workspaceId: workspace_id,
      folderId: folder_id,
    },
  );

  if (result === 'NoPermission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '해당 워크스페이스에 대한 권한이 없습니다.',
    });
  }
  if (result === 'NotFound') {
    throw jsonError(404, {
      code: 'folder_not_found',
      message: '삭제할 폴더를 찾을 수 없습니다.',
    });
  }

  return c.body(null, 204);
});

export { folder };
