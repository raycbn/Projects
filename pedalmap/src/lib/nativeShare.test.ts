import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeShareMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  shareRouteNative: vi.fn(),
  shareRouteToInstagramStory: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}))

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    mkdir: nativeShareMocks.mkdir,
    writeFile: nativeShareMocks.writeFile,
    stat: nativeShareMocks.stat,
  },
  Directory: { Cache: 'CACHE' },
}))

vi.mock('@/lib/routeShare', () => ({
  shareRouteNative: nativeShareMocks.shareRouteNative,
  shareRouteToInstagramStory: nativeShareMocks.shareRouteToInstagramStory,
}))

import { shareRouteCardNative, shareRouteStoryNative } from './nativeShare'

describe('native share image storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nativeShareMocks.mkdir.mockResolvedValue(undefined)
    nativeShareMocks.writeFile.mockResolvedValue(undefined)
    nativeShareMocks.stat.mockImplementation(async ({ path }: { path: string }) => ({
      uri: `file:///mock-cache/${path}`,
    }))
    nativeShareMocks.shareRouteNative.mockResolvedValue(true)
    nativeShareMocks.shareRouteToInstagramStory.mockResolvedValue(true)
  })

  it('stores route share images only under the dedicated cache directory', async () => {
    await expect(
      shareRouteCardNative(
        'Ruta de prueba',
        'Texto de prueba',
        'https://pedalmap.es/route/ruta-test',
        new Blob(['png-data'], { type: 'image/png' }),
      ),
    ).resolves.toBe(true)

    expect(nativeShareMocks.mkdir).toHaveBeenCalledWith({
      path: 'pedalmap-share',
      directory: 'CACHE',
      recursive: true,
    })
    expect(nativeShareMocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'pedalmap-share/pedalmap-share.png',
        directory: 'CACHE',
      }),
    )
    expect(nativeShareMocks.stat).toHaveBeenCalledWith({
      path: 'pedalmap-share/pedalmap-share.png',
      directory: 'CACHE',
    })
    expect(nativeShareMocks.shareRouteNative).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUri: 'file:///mock-cache/pedalmap-share/pedalmap-share.png',
      }),
      expect.any(Number),
      'route',
    )
  })

  it('stores Instagram Story images in the same scoped cache directory', async () => {
    await expect(
      shareRouteStoryNative(
        'Ruta de prueba',
        'Texto de prueba',
        'https://pedalmap.es/route/ruta-test',
        new Blob(['png-data'], { type: 'image/png' }),
      ),
    ).resolves.toBe(true)

    expect(nativeShareMocks.mkdir).toHaveBeenCalledWith({
      path: 'pedalmap-share',
      directory: 'CACHE',
      recursive: true,
    })
    expect(nativeShareMocks.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'pedalmap-share/pedalmap-story.png',
        directory: 'CACHE',
      }),
    )
    expect(nativeShareMocks.stat).toHaveBeenCalledWith({
      path: 'pedalmap-share/pedalmap-story.png',
      directory: 'CACHE',
    })
    expect(nativeShareMocks.shareRouteToInstagramStory).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUri: 'file:///mock-cache/pedalmap-share/pedalmap-story.png',
      }),
      expect.any(Number),
    )
  })
})
