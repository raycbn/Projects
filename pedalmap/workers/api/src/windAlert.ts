import { adminGetDocument, fieldString, getAccessToken, parseServiceAccount, QuotaUnavailableError } from './firestore'
import type { Env } from './types'
import type { FirebaseIdentity } from './firebaseAuth'
import { json } from './types'

type FirestoreDocument = Record<string, unknown>

function fieldsOf(doc: FirestoreDocument | null): Record<string, unknown> {
  return (doc?.fields as Record<string, unknown> | undefined) ?? {}
}

function mapFields(value: unknown): Record<string, unknown> {
  return ((value as { mapValue?: { fields?: Record<string, unknown> } } | undefined)?.mapValue?.fields) ?? {}
}

function stringValue(value: unknown): string | undefined {
  return (value as { stringValue?: string } | undefined)?.stringValue
}

function booleanValue(value: unknown): boolean {
  return (value as { booleanValue?: boolean } | undefined)?.booleanValue === true
}

function documentId(doc: FirestoreDocument): string {
  return typeof doc.name === 'string' ? doc.name.split('/').pop() ?? '' : ''
}

async function listUserRoutesWithWindAlerts(
  projectId: string,
  token: string,
  uid: string,
): Promise<string[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'routes' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
        limit: 1000,
      },
    }),
  })
  if (!response.ok) {
    throw new QuotaUnavailableError(`Wind alert route query failed: ${response.status}`)
  }
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>
  const documents = rows
    .map((row) => row.document)
    .filter((doc): doc is FirestoreDocument => Boolean(doc))
  // Firestore caps this query at 1,000 documents. Reaching that ceiling means
  // there may be legacy active alerts outside the result set; never guess "none".
  if (documents.length >= 1000) {
    throw new QuotaUnavailableError('Wind alert legacy-state query reached its reconciliation limit')
  }
  return documents
    .filter((doc) => booleanValue(fieldsOf(doc).windAlertEnabled))
    .map(documentId)
    .filter(Boolean)
}

async function commitWindAlertChange(
  projectId: string,
  token: string,
  uid: string,
  routeId: string,
  routeDoc: FirestoreDocument,
  enabled: boolean,
  userDoc: FirestoreDocument | null,
  nextUsageFields?: Record<string, unknown>,
): Promise<Response> {
  const now = new Date().toISOString()
  const routeName = `projects/${projectId}/databases/(default)/documents/routes/${routeId}`
  const writes: Record<string, unknown>[] = [
    {
      update: {
        name: routeName,
        fields: {
          windAlertEnabled: { booleanValue: enabled },
          updatedAt: { timestampValue: now },
        },
      },
      updateMask: { fieldPaths: ['windAlertEnabled', 'updatedAt'] },
      currentDocument: { updateTime: routeDoc.updateTime },
    },
  ]

  if (userDoc && nextUsageFields) {
    writes.push({
      update: {
        name: `projects/${projectId}/databases/(default)/documents/users/${uid}`,
        fields: {
          usage: { mapValue: { fields: nextUsageFields } },
          updatedAt: { timestampValue: now },
        },
      },
      updateMask: { fieldPaths: ['usage', 'updatedAt'] },
      currentDocument: { updateTime: userDoc.updateTime },
    })
  }

  return fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ writes }),
    },
  )
}

export type WindAlertUpdateResult =
  | { allowed: true; enabled: boolean }
  | { allowed: false; code: 'route_not_found' | 'route_forbidden' | 'wind_alert_limit' }

export async function setWindAlertEnabledServerSide(
  env: Env,
  uid: string,
  routeId: string,
  enabled: boolean,
): Promise<WindAlertUpdateResult> {
  const serviceAccount = parseServiceAccount(env)
  if (!serviceAccount) throw new QuotaUnavailableError('Service account not configured')
  const projectId = serviceAccount.project_id || env.FIREBASE_PROJECT_ID
  const token = await getAccessToken(serviceAccount)

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const routeDoc = await adminGetDocument(projectId, token, `routes/${routeId}`)
    if (!routeDoc) return { allowed: false, code: 'route_not_found' }
    if (fieldString(routeDoc, 'userId') !== uid) {
      return { allowed: false, code: 'route_forbidden' }
    }
    if (!routeDoc.updateTime) throw new QuotaUnavailableError('Route missing updateTime')
    const routeFields = fieldsOf(routeDoc)
    const currentEnabled = booleanValue(routeFields.windAlertEnabled)

    const userDoc = await adminGetDocument(projectId, token, `users/${uid}`)
    if (!userDoc) {
      if (enabled) throw new QuotaUnavailableError('User document not found')
      const response = await commitWindAlertChange(projectId, token, uid, routeId, routeDoc, false, null)
      if (response.ok) return { allowed: true, enabled: false }
      if (response.status === 409 || response.status === 412) continue
      throw new QuotaUnavailableError(`Wind alert disable failed: ${response.status}`)
    }
    if (!userDoc.updateTime) throw new QuotaUnavailableError('User document missing updateTime')
    const userFields = fieldsOf(userDoc)
    const plan = stringValue(userFields.plan) === 'premium' ? 'premium' : 'free'
    const currentUsage = mapFields(userFields.usage)
    const reservedRouteId = stringValue(currentUsage.windAlertRouteId)

    if (!enabled) {
      if (!currentEnabled && reservedRouteId !== routeId) {
        return { allowed: true, enabled: false }
      }
      let nextUsageFields: Record<string, unknown> | undefined
      if (reservedRouteId === routeId) {
        nextUsageFields = { ...currentUsage }
        delete nextUsageFields.windAlertRouteId
      }
      const response = await commitWindAlertChange(
        projectId, token, uid, routeId, routeDoc, false, userDoc, nextUsageFields,
      )
      if (response.ok) return { allowed: true, enabled: false }
      if (response.status === 409 || response.status === 412) continue
      throw new QuotaUnavailableError(`Wind alert disable failed: ${response.status}`)
    }

    if (plan === 'premium') {
      if (currentEnabled) return { allowed: true, enabled: true }
      const response = await commitWindAlertChange(projectId, token, uid, routeId, routeDoc, true, null)
      if (response.ok) return { allowed: true, enabled: true }
      if (response.status === 409 || response.status === 412) continue
      throw new QuotaUnavailableError(`Wind alert enable failed: ${response.status}`)
    }

    if (currentEnabled && reservedRouteId === routeId) {
      return { allowed: true, enabled: true }
    }
    if (reservedRouteId && reservedRouteId !== routeId) {
      return { allowed: false, code: 'wind_alert_limit' }
    }

    // Legacy active alerts are reconciled before claiming the per-user slot.
    const activeRouteIds = await listUserRoutesWithWindAlerts(projectId, token, uid)
    if (activeRouteIds.some((activeRouteId) => activeRouteId !== routeId)) {
      return { allowed: false, code: 'wind_alert_limit' }
    }

    const nextUsageFields = {
      ...currentUsage,
      windAlertRouteId: { stringValue: routeId },
    }
    const response = await commitWindAlertChange(
      projectId, token, uid, routeId, routeDoc, true, userDoc, nextUsageFields,
    )
    if (response.ok) return { allowed: true, enabled: true }
    if (response.status === 409 || response.status === 412) continue
    throw new QuotaUnavailableError(`Wind alert enable failed: ${response.status}`)
  }

  // All retries are conditional writes. Contention fails closed instead of granting a second slot.
  throw new QuotaUnavailableError('Wind alert changed concurrently; retry')
}

export async function handleSetWindAlert(
  request: Request,
  env: Env,
  identity: FirebaseIdentity,
): Promise<Response> {
  if (identity.isAnonymous) {
    return json({ error: 'Inicia sesión con una cuenta real', code: 'auth_required' }, 401)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'JSON inválido', code: 'invalid_json' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Solicitud inválida', code: 'invalid_body' }, 400)
  }

  const input = body as Record<string, unknown>
  const routeId = typeof input.routeId === 'string' ? input.routeId.trim() : ''
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(routeId) || typeof input.enabled !== 'boolean') {
    return json({ error: 'routeId y enabled son obligatorios', code: 'invalid_body' }, 400)
  }

  try {
    const result = await setWindAlertEnabledServerSide(env, identity.uid, routeId, input.enabled)
    if (!result.allowed) {
      const status = result.code === 'route_not_found' ? 404 : result.code === 'route_forbidden' ? 403 : 403
      const error = result.code === 'wind_alert_limit'
        ? 'Has alcanzado el límite de alertas de viento del plan Free.'
        : result.code === 'route_forbidden'
          ? 'No puedes modificar alertas de una ruta que no es tuya.'
          : 'La ruta no existe.'
      return json({ error, code: result.code }, status)
    }
    return json({ ok: true, enabled: result.enabled })
  } catch (error) {
    console.error('[wind-alert]', error instanceof Error ? error.message : 'unknown error')
    return json({ error: 'No se pudo verificar o actualizar la cuota de alertas.', code: 'quota_unavailable' }, 503)
  }
}
