import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlannerFormView } from '@/components/route/PlannerFormView'
import type { RouteDraft } from '@/domain/types'

const dummyDraft: RouteDraft = {
  title: 'Circular desde inicio',
  type: 'circular',
  bikeType: 'road',
  preferences: [],
  waypoints: [],
  geometry: { type: 'LineString', coordinates: [[0, 0], [0.001, 0.001]] },
  elevationProfile: [],
  stats: {
    distanceMeters: 52000,
    elevationGainMeters: 380,
    elevationLossMeters: 120,
    estimatedDurationSeconds: 3600,
    difficulty: 'moderate',
  },
  circularDistanceMeters: 50000,
  targetElevationGainMeters: 400,
  circularSeed: 1,
}

const defaultProps = {
  modeChips: null,
  routeType: 'circular' as const,
  status: 'success' as const,
  waypoints: [],
  locating: false,
  onLocate: () => {},
  canReset: true,
  onResetPlan: () => {},
  onSetStart: () => {},
  onSetEnd: () => {},
  onAddVia: () => {},
  onUpdateWaypointPosition: () => {},
  onRemoveWaypoint: () => {},
  onMoveWaypoint: () => {},
  viaQueryOpen: false,
  onToggleViaQuery: () => {},
  circularDistanceMeters: 50000,
  onCircularDistanceChange: () => {},
  targetElevationGainMeters: 400,
  onTargetElevationChange: () => {},
  bikeType: 'road' as const,
  onBikeTypeChange: () => {},
  compareBusy: false,
  canCalculate: true,
  onCompare: () => {},
  compareRows: null,
  onPickCompare: () => {},
  onCloseCompare: () => {},
  preferences: [],
  onPreferencesChange: () => {},
  profile: null,
  onLimitReached: () => {},
  wantAlternatives: false,
  onWantAlternativesChange: () => {},
  panelError: null,
  activeDraft: dummyDraft,
  surfaceAlert: null,
  objetivoFeedback: null as { status: string; actual: string } | null,
  onSelectRouteOption: () => {},
  onPremiumRequired: () => {},
  onSelectAlternative: () => {},
  onAnotherVariant: () => {},
  onGoToReady: () => {},
  onAdjustOnMap: () => {},
  onGpxImported: () => {},
  onSaveEdits: () => {},
  onCancelEditing: () => {},
  onSelectRide: undefined,
  rideRecommendations: undefined,
  ctaDisabled: false,
  ctaLabel: 'Ver ruta lista',
  onCreate: () => {},
}

describe('PlannerFormView objective feedback', () => {
  it('renders "Objetivo conseguido" when feedback status is positive', () => {
    render(
      <PlannerFormView
        {...defaultProps}
        objetivoFeedback={{ status: 'Objetivo conseguido', actual: '52,0 km · +380 m' }}
      />,
    )
    expect(screen.getByText('Objetivo conseguido')).toBeTruthy()
    expect(screen.getByText(/52,0 km/)).toBeTruthy()
  })

  it('renders "Objetivo aproximado" when feedback status is approximate', () => {
    render(
      <PlannerFormView
        {...defaultProps}
        objetivoFeedback={{ status: 'Objetivo aproximado', actual: '54,0 km · +420 m' }}
      />,
    )
    expect(screen.getByText('Objetivo aproximado')).toBeTruthy()
  })

  it('renders "Alternativa más cercana" when feedback status is closest', () => {
    render(
      <PlannerFormView
        {...defaultProps}
        objetivoFeedback={{ status: 'Alternativa más cercana', actual: '58,0 km · +760 m' }}
      />,
    )
    expect(screen.getByText('Alternativa más cercana')).toBeTruthy()
  })

  it('does not render feedback when objetivoFeedback is null', () => {
    render(<PlannerFormView {...defaultProps} objetivoFeedback={null} />)
    expect(screen.queryByText('Objetivo conseguido')).toBeNull()
    expect(screen.queryByText('Objetivo aproximado')).toBeNull()
    expect(screen.queryByText('Alternativa más cercana')).toBeNull()
  })
})
