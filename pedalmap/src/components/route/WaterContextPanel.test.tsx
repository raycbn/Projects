import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaterContextPanel } from '@/components/route/WaterContextPanel'
import type { WaterPoint } from '@/domain/routeEnricher'

const makePoint = (overrides: Partial<WaterPoint> = {}): WaterPoint => ({
  id: 'node/1',
  position: { lat: 50.7, lng: 7.1 },
  distanceAlongRouteMeters: 3200,
  detourMeters: 180,
  name: 'Fuente A',
  ...overrides,
})

describe('WaterContextPanel', () => {
  it('renders loading state', () => {
    render(<WaterContextPanel recommendedPoints={[]} allPoints={[]} loading degraded={false} />)
    expect(document.querySelector('.animate-pulse-soft')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /fuentes en ruta/i })).toBeNull()
  })

  it('renders degraded state', () => {
    render(<WaterContextPanel recommendedPoints={[]} allPoints={[]} loading={false} degraded degradedReason="upstream_unavailable" />)
    expect(screen.getByText(/no se pudieron cargar/i)).toBeTruthy()
    expect(screen.getByText(/upstream_unavailable/)).toBeTruthy()
  })

  it('renders empty state', () => {
    render(<WaterContextPanel recommendedPoints={[]} allPoints={[]} loading={false} degraded={false} />)
    expect(screen.getByText(/no se detectaron fuentes/i)).toBeTruthy()
  })

  it('renders recommended points list', () => {
    const recommended = [makePoint(), makePoint({ id: 'node/2', name: 'Fuente B' })]
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={recommended} loading={false} degraded={false} />)
    expect(screen.getByText('Fuente A')).toBeTruthy()
    expect(screen.getByText('Fuente B')).toBeTruthy()
    expect(screen.getAllByText(/3,2 km del inicio/).length).toBeGreaterThanOrEqual(1)
  })

  it('opens Ver todas and shows pagination', () => {
    const recommended = [makePoint()]
    const all = Array.from({ length: 25 }, (_, i) => makePoint({ id: `node/${i}`, name: `Fuente ${i}` }))
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={all} loading={false} degraded={false} />)
    fireEvent.click(screen.getByText(/ver todas las fuentes/i))
    expect(screen.getByText(/25 encontradas/)).toBeTruthy()
    expect(screen.getByText(/fuentes 1–10 de 25/i)).toBeTruthy()
  })

  it('paginates all points', () => {
    const recommended: WaterPoint[] = []
    const all = Array.from({ length: 25 }, (_, i) => makePoint({ id: `node/${i}`, name: `Fuente ${i}` }))
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={all} loading={false} degraded={false} />)
    fireEvent.click(screen.getByText(/ver todas las fuentes/i))
    expect(screen.getByText('Fuente 0')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /→/i }))
    expect(screen.getByText('Fuente 10')).toBeTruthy()
  })

  it('opens drawer with details when clicking Ver fuente', () => {
    const recommended = [makePoint({ address: 'Calle Mayor', access: 'public', drinkingWater: 'yes', description: 'Fuente histórica', website: 'https://example.com', phone: '+34 900 000 000' })]
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={recommended} loading={false} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: /ver fuente/i }))
    expect(screen.getByRole('heading', { name: /fuente a/i })).toBeTruthy()
    expect(screen.getByText(/Calle Mayor/)).toBeTruthy()
    expect(screen.getByText(/Acceso: public/)).toBeTruthy()
    expect(screen.getByText(/Agua potable: yes/)).toBeTruthy()
    expect(screen.getByText(/Fuente histórica/)).toBeTruthy()
    expect(screen.getByText(/https:\/\/example\.com/)).toBeTruthy()
    expect(screen.getByText(/\+34 900 000 000/)).toBeTruthy()
  })

  it('calls onNavigate when clicking Cómo llegar', () => {
    const onNavigate = vi.fn()
    const recommended = [makePoint()]
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={recommended} loading={false} degraded={false} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /ver fuente/i }))
    fireEvent.click(screen.getByRole('button', { name: /cómo llegar/i }))
    expect(onNavigate).toHaveBeenCalledWith(recommended[0])
  })

  it('calls onFocusMap when clicking Ver en mapa', () => {
    const onFocusMap = vi.fn()
    const recommended = [makePoint()]
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={recommended} loading={false} degraded={false} onFocusMap={onFocusMap} />)
    fireEvent.click(screen.getByRole('button', { name: /ver fuente/i }))
    fireEvent.click(screen.getByRole('button', { name: /ver en mapa/i }))
    expect(onFocusMap).toHaveBeenCalledWith(recommended[0])
  })

  it('closes drawer on backdrop click', () => {
    const recommended = [makePoint()]
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={recommended} loading={false} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: /ver fuente/i }))
    expect(screen.getByRole('heading', { name: /fuente a/i })).toBeTruthy()
    const backdrop = document.querySelector('.absolute.inset-0')
    if (backdrop) fireEvent.click(backdrop)
    expect(screen.queryByRole('heading', { name: /fuente a/i })).toBeNull()
  })

  it('does not render drawer actions when callbacks missing', () => {
    const recommended = [makePoint()]
    render(<WaterContextPanel recommendedPoints={recommended} allPoints={recommended} loading={false} degraded={false} />)
    fireEvent.click(screen.getByRole('button', { name: /ver fuente/i }))
    expect(screen.queryByRole('button', { name: /cómo llegar/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /ver en mapa/i })).toBeNull()
  })
})
