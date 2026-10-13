import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveGpxFile } from '@/lib/saveFile'

const { platform, writeFile, stat } = vi.hoisted(() => ({
  platform: { value: 'web' },
  writeFile: vi.fn(async (_opts: { path: string; data: unknown; encoding?: string; directory?: string }) => ({ uri: 'file:///x' })),
  stat: vi.fn(async (_opts: { path: string }) => ({ uri: 'file:///x', size: 100, name: 'ruta.gpx', type: 'file', mtime: 0 })),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.value, isNativePlatform: () => platform.value !== 'web' },
}))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile, stat },
  Directory: { Documents: 'Documents' },
  Encoding: { UTF8: 'utf8' },
}))

type ShareArg = { files: File[]; title?: string; text?: string }

function setShare(
  supported: boolean,
  impl: (data: ShareArg) => Promise<void> = async () => {},
) {
  const share = vi.fn<(data: ShareArg) => Promise<void>>(impl)
  const canShare = vi.fn<(opts: ShareArg) => boolean>(() => supported)
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  return { share, canShare }
}

function setNoShare() {
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
}

describe('saveGpxFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setNoShare()
    platform.value = 'web'
    writeFile.mockClear()
    stat.mockClear()
  })

  it('rejects filenames not ending in .gpx', async () => {
    const { share, canShare } = setShare(true)
    await expect(saveGpxFile('<gpx/>', 'ruta.txt')).rejects.toThrow(/\.gpx/)
    expect(canShare).not.toHaveBeenCalled()
    expect(share).not.toHaveBeenCalled()
  })

  it('uses the Web Share API with a .gpx File when supported', async () => {
    const { share, canShare } = setShare(true)
    const result = await saveGpxFile('<gpx/>', 'ruta.gpx')

    expect(result).toBe('shared')
    expect(canShare).toHaveBeenCalledTimes(1)
    const files = canShare.mock.calls[0][0].files
    expect(files).toHaveLength(1)
    expect(files[0]).toBeInstanceOf(File)
    expect(files[0].name).toBe('ruta.gpx')
    expect(files[0].type).toBe('application/gpx+xml')
    expect(share).toHaveBeenCalledTimes(1)
  })

  it('passes GPX content verbatim into the shared File', async () => {
    const { share } = setShare(true)
    const xml = '<?xml version="1.0"?><gpx></gpx>'
    await saveGpxFile(xml, 'ruta.gpx')

    const file = share.mock.calls[0][0].files[0]
    expect(file.name).toBe('ruta.gpx')
    expect(file.type).toBe('application/gpx+xml')
    expect(file.size).toBe(xml.length)
  })

  it('returns "canceled" when the user dismisses the share sheet', async () => {
    setShare(true, async () => {
      throw new DOMException('aborted', 'AbortError')
    })
    const createElement = vi.spyOn(document, 'createElement')

    const result = await saveGpxFile('<gpx/>', 'ruta.gpx')

    expect(result).toBe('canceled')
    // No fallback download anchor must be created when the user cancels.
    expect(createElement).not.toHaveBeenCalled()
  })

  it('falls back to Blob + <a download> when share is unsupported', async () => {
    const click = vi.fn()
    const a: Record<string, unknown> = { href: '', download: '', click }
    vi.spyOn(document, 'createElement').mockReturnValue(a as unknown as HTMLAnchorElement)
    const url = 'blob:abcd'
    vi.stubGlobal('URL', {
      createObjectURL: () => url,
      revokeObjectURL: vi.fn(),
    })

    const result = await saveGpxFile('<gpx/>', 'ruta.gpx')

       expect(result).toBe('downloaded')
    expect(a.download).toBe('ruta.gpx')
    expect(a.href).toBe(url)
    expect(click).toHaveBeenCalled()
  })

   it('passes data as string with UTF8 encoding to native Filesystem when canShare is unavailable', async () => {
     platform.value = 'android'
     writeFile.mockResolvedValue({ uri: 'file:///storage/emulated/0/Documents/ruta.gpx' })

     const result = await saveGpxFile('<gpx/>', 'ruta.gpx')

     expect(result).toBe('saved')
     expect(writeFile).toHaveBeenCalledTimes(1)
     const opts = writeFile.mock.calls[0][0]
     expect(opts.path).toBe('ruta.gpx')
     expect(typeof opts.data).toBe('string')
     expect(opts.data).toBe('<gpx/>')
     expect(opts.encoding).toBe('utf8')
     expect(opts.directory).toBe('Documents')
   })
})
