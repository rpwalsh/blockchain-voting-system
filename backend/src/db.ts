import { PrismaClient as PrismaClientRuntime } from '@prisma/client';
import type { PrismaClient as PrismaClientGenerated } from '../node_modules/.prisma/client';

// NOTE: Prisma Client is generated from `prisma/schema.prisma`.
// Occasionally VS Code's TS language service lags behind `prisma generate` and
// reports missing model delegates. Typing the instance using the generated
// client declarations forces the editor to align with the actual generated API.
// Runtime behavior is unchanged.
export const prisma: PrismaClientGenerated = new PrismaClientRuntime() as unknown as PrismaClientGenerated;
