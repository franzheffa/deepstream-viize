import { PrismaClient } from '@prisma/client'
import { readDirectDatabaseUrl } from './env'

const resolvedDatabaseUrl = readDirectDatabaseUrl()

if (resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  return new PrismaClient({
    log: ['error'],
  })
}

export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }

  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getPrismaClient(), property, receiver)
  },
})
