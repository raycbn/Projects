export type Plan = 'free' | 'premium'
export type CheckoutProduct = 'solo' | 'grupeta'

export interface SubRecord {
  status?: string
  plan?: string
  soloSubscriptionId?: string
  soloStatus?: string
  grupetaSubscriptionId?: string
  grupetaStatus?: string
}

export interface StripeSubSummary {
  status: string
  product: CheckoutProduct
  id: string
  hasTrialed: boolean
}

export interface EvaluatePlanInput {
  allowlisted: boolean
  sub: SubRecord | null
  customerId?: string
  stripeSubs: StripeSubSummary[]
  email?: string | null
  emailVerified: boolean
  hasGrupetaSeat: boolean
  annualTrialUsed?: boolean
}

export interface EvaluatePlanResult {
  plan: Plan
  status: string
  product: CheckoutProduct
  shouldWritePlan: boolean
  shouldUpsert: boolean
  stripeSubscriptionId?: string
  soloSubscriptionId?: string
  soloStatus?: string
  grupetaSubscriptionId?: string
  grupetaStatus?: string
  annualTrialUsed: boolean
}

function isPayingStatus(status?: string): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

export function evaluatePlan(input: EvaluatePlanInput): EvaluatePlanResult {
  if (input.allowlisted) {
    return {
      plan: 'premium',
      status: 'active',
      product: 'solo',
      shouldWritePlan: true,
      shouldUpsert: false,
      stripeSubscriptionId: undefined,
      annualTrialUsed: input.annualTrialUsed ?? false,
    }
  }

  const sub = input.sub
  const soloPay = isPayingStatus(sub?.soloStatus)
  const grupetaPay = isPayingStatus(sub?.grupetaStatus)
  const legacyPay = isPayingStatus(sub?.status) && !sub?.soloStatus && !sub?.grupetaStatus

  if (soloPay || grupetaPay || legacyPay) {
    const product: CheckoutProduct = grupetaPay ? 'grupeta' : 'solo'
    const status = sub?.status || (grupetaPay ? sub?.grupetaStatus ?? 'active' : sub?.soloStatus ?? 'active')
    return {
      plan: 'premium',
      status,
      product,
      shouldWritePlan: sub?.plan !== 'premium',
      shouldUpsert: false,
      stripeSubscriptionId: sub?.soloStatus ? sub?.soloSubscriptionId : sub?.grupetaSubscriptionId,
      soloSubscriptionId: sub?.soloSubscriptionId,
      soloStatus: sub?.soloStatus,
      grupetaSubscriptionId: sub?.grupetaSubscriptionId,
      grupetaStatus: sub?.grupetaStatus,
      annualTrialUsed: input.annualTrialUsed ?? false,
    }
  }

  if (input.customerId && input.stripeSubs.length > 0) {
    const stripePaying = input.stripeSubs.filter((s) => isPayingStatus(s.status))
    if (stripePaying.length > 0) {
      const stripeSub = stripePaying[0]
      const product: CheckoutProduct = stripeSub.product === 'grupeta' ? 'grupeta' : 'solo'
      const nextSoloId = product === 'solo' ? stripeSub.id : sub?.soloSubscriptionId
      const nextSoloStatus = product === 'solo' ? stripeSub.status : sub?.soloStatus
      const nextGrupetaId = product === 'grupeta' ? stripeSub.id : sub?.grupetaSubscriptionId
      const nextGrupetaStatus = product === 'grupeta' ? stripeSub.status : sub?.grupetaStatus
      return {
        plan: 'premium',
        status: stripeSub.status,
        product,
        shouldWritePlan: true,
        shouldUpsert: true,
        stripeSubscriptionId: stripeSub.id,
        soloSubscriptionId: nextSoloId,
        soloStatus: nextSoloStatus,
        grupetaSubscriptionId: nextGrupetaId,
        grupetaStatus: nextGrupetaStatus,
        annualTrialUsed: Boolean(stripeSub.hasTrialed || input.annualTrialUsed),
      }
    }
  }

  return {
    plan: 'free',
    status: 'canceled',
    product: 'solo',
    shouldWritePlan: true,
    shouldUpsert: false,
    stripeSubscriptionId: undefined,
    annualTrialUsed: input.annualTrialUsed ?? false,
  }
}
