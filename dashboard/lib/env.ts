function normalize(value: string) {
  return value.replace(/\\n/g, '').replace(/\n/g, '').trim()
}

export function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]
    if (!value) {
      continue
    }

    const cleaned = normalize(value)
    if (cleaned) {
      return cleaned
    }
  }

  return ''
}

export function readDirectDatabaseUrl() {
  const candidates = [
    readEnv('DATABASE_URL'),
    readEnv('POSTGRES_URL'),
    readEnv('PRISMA_DATABASE_URL'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate.startsWith('postgres://') || candidate.startsWith('postgresql://')) {
      return candidate
    }
  }

  return candidates[0] || ''
}
