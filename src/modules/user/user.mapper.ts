import type { User as PrismaUser } from '@prisma/client';
import type { PublicUser, User } from './user.schema';

export const toPublicUser = (user: User | PrismaUser): PublicUser => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  };
};
