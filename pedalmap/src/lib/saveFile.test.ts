import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveGpxFile } from '@/lib/saveFile'

const { platform, writeFile } = vi.hoisted(() => ({
  platform: { value: 'web' },
  writeFile: vi.fn(async (_opts: { path: string; data: string; directory: string }) => ({ uri: 'file:///x' })),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value },
}))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile },
  Directory: { Data: 'Data' },
}))

describe('saveGpxFile', () => {
  beforeEach(() => {
    platform.value = 'web'
    writeFile.mockClear()
    writeFile.mockImplementation(async () => ({ uri: 'file:///x' }))
  })

  it('web path keeps Blob + download behaviour (no Filesystem call)', async () => {
    const click = vi.fn()
    const a: Record<string, unknown> = { href: '', download: '', click }
    vi.spyOn(document, 'createElement').mockReturnValue(a as unknown as HTMLAnchorElement)
    const url = 'blob:abcd'
    vi.stubGlobal('URL', {
      createObjectURL: () => url,
      revokeObjectURL: vi.fn(),
    })

    await saveGpxFile('<gpx/>', 'ruta.gpx')

    expect(writeFile).not.toHaveBeenCalled()
    expect(a.download).toBe('ruta.gpx')
    expect(a.href).toBe(url)
    expect(click).toHaveBeenCalled()
  })

  it('android path calls Filesystem.writeFile with .gpx name and raw gpx data', async () => {
    platform.value = 'android'

    await saveGpxFile('<gpx/>', 'ruta.gpx')

    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile).toHaveBeenCalledWith({
      path: 'ruta.gpx',
      data: '<gpx/>',
      directory: 'Data',
    })
  })

  it('preserves the slug-based filename ending in .gpx', async () => {
    platform.value = 'android'
    await saveGpxFile('<gpx/>', 'mi-ruta-circular.gpx')
    const call = writeFile.mock.calls[0]?.[0]
    expect(call?.path).toBe('mi-ruta-circular.gpx')
    expect(call?.path.endsWith('.gpx')).toBe(true)
  })

  it('rejects filenames not ending in .gpx', async () => {
    await expect(saveGpxFile('<gpx/>', 'ruta.txt')).rejects.toThrow(/\.gpx/)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('does not crash the app on Filesystem.write failure (rejected promise)', async () => {
    platform.value = 'android'
    writeFile.mockRejectedValueOnce(new Error('disk full'))
    await expect(saveGpxFile('<gpx/>', 'ruta.gpx')).rejects.toThrow('disk full')
  })

  it('GPX content is passed verbatim (no transformation for web)', async () => {
    const xml = '<?xml version="1.0"?><gpx></gpx>'
    const click = vi.fn()
    const a: Record<string, unknown> = { href: '', download: '', click }
    vi.spyOn(document, 'createElement').mockReturnValue(a as unknown as HTMLAnchorElement)
    vi.stubGlobal('URL', {
      createObjectURL: (b: Blob) => expect(b.type).toBe('application/gpx+xml'),
      revokeObjectURL: vi.fn(),
    })

    await saveGpxFile(xml, 'ruta.gpx')
    // content equality for android path
    platform.value = 'android'
    writeFile.mockClear()
    writeFile.mockImplementation(async () => ({ uri: 'file:///x' }))
    await saveGpxFile(xml, 'ruta.gpx')
    expect(writeFile.mock.calls[0]?.[0]?.data).toBe(xml)
  })
})
