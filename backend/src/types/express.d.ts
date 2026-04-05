import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: number;
      googleId: string;
      email: string;
      name: string | null;
    }
  }
}
