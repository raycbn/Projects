import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthForm } from './AuthForm'

vi.mock('@/app/AuthContext', () => ({
  useAuth: () => ({
    signInEmail: vi.fn(),
    registerEmail: vi.fn(),
    signInGoogle: vi.fn(),
    resetPassword: vi.fn(),
    firebaseReady: true,
    authError: null,
    clearAuthError: vi.fn(),
  }),
}))

describe('AuthForm registration conversion', () => {
  it('explains Free account benefits and does not offer a guest escape on register', () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<AuthForm mode="register" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText(/15 creaciones al mes, 5 rutas guardadas y 1 GPX semanal/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /seguir como invitado/i })).toBeNull()
    expect(screen.getByRole('button', { name: /continuar con google/i })).toBeTruthy()
  })

  it('does not offer guest mode to people who intentionally opened login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<AuthForm mode="login" />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: /seguir como invitado/i })).toBeNull()
    expect(screen.getByRole('link', { name: /regístrate/i })).toBeTruthy()
  })
})
