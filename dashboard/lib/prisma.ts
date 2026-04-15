import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { readDirectDatabaseUrl } from './env'

const resolvedDatabaseUrl = readDirectDatabaseUrl()

if (resolvedDatabaseUrl) {
  process.env.DATABASE_URL = resolvedDatabaseUrl
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  if (resolvedDatabaseUrl) {
    const adapter = new PrismaPg(
      new Pool({
        connectionString: resolvedDatabaseUrl,
      }),
    )

    return new PrismaClient({
      adapter,
      log: ['error'],
    })
  }

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
