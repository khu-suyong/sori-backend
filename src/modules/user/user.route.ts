import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { toPublicUser } from './user.mapper';
import { EditableUserSchema, PublicUserSchema } from './user.schema';
import { fetchUser, updateUser } from './user.service';

import { jwt } from '../../lib/jwt';
import { jsonError } from '../../lib/exception';
import { ExceptionBodySchema } from '../common/common.schema';

const user = new OpenAPIHono();
user.use('*', jwt());

const getUserRoute = createRoute({
  method: 'get',
  path: '/',
  description: '인증된 유저의 정보를 반환합니다.',
  tags: ['User'],
  summary: '유저 조회',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicUserSchema,
        },
      },
      description: '요청한 유저의 정보.',
    },
    401: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: 'Authorization 헤더가 없거나 토큰 검증에 실패한 경우.',
    },
    404: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: '유저를 찾을 수 없는 경우.',
    },
  },
  security: [
    {
      AccessToken: [], 
    },
  ],
});
user.openapi(getUserRoute, async (c) => {
  const userId = c.get('userId');

  const user = await fetchUser(c.var.prisma, { id: userId });
  if (!user) {
    throw jsonError(404, {
      code: 'user_not_found',
      message: '유저를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicUser(user), 200);
});

const updateUserRoute = createRoute({
  method: 'patch',
  path: '/',
  description: '인증된 유저의 수정 가능한 필드를 업데이트합니다.',
  tags: ['User'],
  summary: '유저 정보 수정',
  request: {
    body: {
      content: {
        'application/json': {
          schema: EditableUserSchema,
        },
      },
      description: '수정 가능한 유저 필드가 포함된 JSON 본문.',
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicUserSchema,
        },
      },
      description: '수정 완료 후 유저 정보.',
    },
    401: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: 'Authorization 헤더가 없거나 토큰 검증에 실패한 경우.',
    },
    404: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: '유저를 찾을 수 없는 경우.',
    },
  },
  security: [
    {
      AccessToken: [],
    },
  ],
});
user.openapi(updateUserRoute, async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  const user = await updateUser(c.var.prisma, { id: userId }, body);
  if (!user) {
    throw jsonError(404, {
      code: 'user_not_found',
      message: '유저를 찾을 수 없습니다.',
    });
  }

  return c.json(toPublicUser(user), 200);
});

export { user };
