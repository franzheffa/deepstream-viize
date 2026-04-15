export const ROLE_ORDER = ['viewer', 'operator', 'manager', 'admin', 'owner'] as const

export function roleRank(role: string) {
  const index = ROLE_ORDER.indexOf((role || 'viewer') as (typeof ROLE_ORDER)[number])
  return index === -1 ? 0 : index
}

export function hasRole(role: string, minimum: string) {
  return roleRank(role) >= roleRank(minimum)
}
