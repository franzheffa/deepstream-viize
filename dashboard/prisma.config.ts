import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'
import { readDirectDatabaseUrl } from './lib/env'

const databaseUrl = readDirectDatabaseUrl()

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
