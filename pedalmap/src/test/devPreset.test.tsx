import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DevPresetPage from '@/pages/DevPresetPage'

// DEV-ONLY wiring test: the seed page must stash the ready route packet and
// set the fake host auth plan, then navigate to /ruta — without contacting
// production Firebase.
describe('DevPresetPage (DEV test harness)', () => {
  beforeEach(() => sessionStorage.clear())

  it('seeds the ready-route handoff + dev auth (premium) from the query plan', () => {
    render(
      <MemoryRouter initialEntries={['/dev/demo?plan=premium']}>
        <Routes>
          <Route path="dev/demo" element={<DevPresetPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(sessionStorage.getItem('pm_dev_auth')).toBe('premium')
    const raw = sessionStorage.getItem('pedalmap_ready_route')
    expect(raw).not.toBeNull()
    const packet = JSON.parse(raw!)
    expect(packet.draft.title).toMatch(/DEV/)
    expect(packet.draft.stats).toMatchObject({
      distanceMeters: 5200,
      elevationGainMeters: 120,
      estimatedDurationSeconds: 1080,
    })
  })

  it('defaults dev auth to free when plan query is absent', () => {
    render(
      <MemoryRouter initialEntries={['/dev/demo']}>
        <Routes>
          <Route path="dev/demo" element={<DevPresetPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(sessionStorage.getItem('pm_dev_auth')).toBe('free')
  })
})
