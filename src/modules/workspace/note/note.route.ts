import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

import { toPublicNote } from './note.mapper';
import { createNote, deleteNote, updateNote } from './note.service';
import { CreatableNoteSchema, PublicNoteSchema } from './note.schema';

import { ID } from '../../common/common.schema';
import { jsonError } from '../../../lib/exception';
import { Public } from '@prisma/client/runtime/library';

const note = new OpenAPIHono();

const createNoteRoute = createRoute({
  method: 'post',
  path: '/',
  description: '노트를 생성합니다.',
  tags: ['Workspace'],
  summary: '노트 생성',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '노트를 생성할 워크스페이스의 ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreatableNoteSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: PublicNoteSchema,
        },
      },
      description: '생성된 노트의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
note.openapi(createNoteRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id } = c.req.valid('param');
  const body = c.req.valid('json');

  const note = await createNote(
    c.var.prisma,
    { userId, workspaceId: workspace_id },
    body,
  );

  if (note === 'NoPermission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '해당 워크스페이스에 대한 권한이 없습니다.',
    });
  }

  return c.json(toPublicNote(note), 201);
});

const updateNoteRoute = createRoute({
  method: 'patch',
  path: '/{note_id}',
  description: '노트를 수정합니다.',
  tags: ['Workspace'],
  summary: '노트 수정',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '노트를 수정할 워크스페이스의 ID' }),
      'note_id': ID.openapi({ description: '수정할 노트의 ID' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreatableNoteSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicNoteSchema,
        },
      },
      description: '수정된 노트의 정보.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
note.openapi(updateNoteRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id, note_id } = c.req.valid('param');
  const body = c.req.valid('json');

  const note = await updateNote(
    c.var.prisma,
    { userId, workspaceId: workspace_id, noteId: note_id },
    body,
  );

  if (note === 'NoPermission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '해당 워크스페이스에 대한 권한이 없습니다.',
    });
  }
  if (note === 'NotFound') {
    throw jsonError(404, {
      code: 'not_found',
      message: '수정하려는 노트를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicNote(note), 200);
});

const deleteNoteRoute = createRoute({
  method: 'delete',
  path: '/{note_id}',
  description: '노트를 삭제합니다.',
  tags: ['Workspace'],
  summary: '노트 삭제',
  request: {
    params: z.object({
      'workspace_id': ID.openapi({ description: '노트를 삭제할 워크스페이스의 ID' }),
      'note_id': ID.openapi({ description: '삭제할 노트의 ID' }),
    }),
  },
  responses: {
    204: {
      description: '노트가 성공적으로 삭제됨.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
note.openapi(deleteNoteRoute, async (c) => {
  const userId = c.get('userId');
  const { workspace_id, note_id } = c.req.valid('param');

  const note = await deleteNote(
    c.var.prisma,
    { userId, workspaceId: workspace_id, noteId: note_id },
  );

  if (note === 'NoPermission') {
    throw jsonError(403, {
      code: 'no_permission',
      message: '해당 워크스페이스에 대한 권한이 없습니다.',
    });
  }
  if (note === 'NotFound') {
    throw jsonError(404, {
      code: 'not_found',
      message: '수정하려는 노트를 찾을 수 없습니다.',
    });
  }

  return c.body(null, 204);
});

export { note };
