import { NextResponse } from 'next/server'
import { applySessionCookie } from '../../../../lib/auth'
import { bootstrapOwnerAndStore } from '../../../../lib/seed-data'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const displayName = String(body?.displayName || '').trim()

    if (!email || !email.includes('@') || password.length < 8 || displayName.length < 2) {
      return NextResponse.json({ error: 'Informations invalides pour le bootstrap owner.' }, { status: 400 })
    }

    const { user, store, role } = await bootstrapOwnerAndStore({ email, password, displayName })
    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, displayName: user.displayName },
      store: { id: store.id, name: store.name, slug: store.slug },
      role,
    })

    applySessionCookie(response, {
      userId: user.id,
      storeId: store.id,
      role,
      email: user.email,
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'bootstrap_locked') {
      return NextResponse.json({ error: 'Le bootstrap est verrouille car un compte existe deja.' }, { status: 409 })
    }

    console.error('[auth/bootstrap] failed', error)
    return NextResponse.json({ error: 'Impossible de lancer le bootstrap owner.' }, { status: 500 })
  }
}
