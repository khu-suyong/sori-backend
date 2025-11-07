import { Hono } from 'hono';

import { fetchUser } from './user.service';
import { toPublicUser } from './user.mapper';

import { jwt } from '../../lib/jwt';

const user = new Hono();
user.use('*', jwt());

user.get('/', async (c) => {
  const userId = c.get('userId');

  const user = await fetchUser(c.var.prisma, { id: userId });
  if (!user) {
    return c.json({ message: 'User not found' }, 404);
  }

  return c.json(toPublicUser(user));
});

export { user };
