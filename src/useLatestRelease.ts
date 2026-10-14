import { useEffect, useState } from 'react'

// Live data from GitHub Releases of cjbarnes29/chattingchatter.
const REPO = 'cjbarnes29/chattingchatter'
const API = `https://api.github.com/repos/${REPO}/releases/latest`
const CACHE_KEY = 'chatter-latest-release'

export type ReleaseAsset = { name: string; url: string; size: number }
export type LatestRelease = {
  version: string
  pageUrl: string
  assets: ReleaseAsset[]
}

function readCache(): LatestRelease | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as LatestRelease) : null
  } catch {
    return null
  }
}

/** Finds the first asset whose file name matches the pattern. */
export function findAsset(release: LatestRelease | null, pattern: RegExp): ReleaseAsset | undefined {
  return release?.assets.find((a) => pattern.test(a.name))
}

export function useLatestRelease() {
  const [release, setRelease] = useState<LatestRelease | null>(readCache)
  const [loading, setLoading] = useState(!release)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const next: LatestRelease = {
          version: data.tag_name ?? data.name ?? '',
          pageUrl: data.html_url,
          assets: (data.assets ?? []).map((a: { name: string; browser_download_url: string; size: number }) => ({
            name: a.name,
            url: a.browser_download_url,
            size: a.size,
          })),
        }
        setRelease(next)
        setError(false)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next))
        } catch {
          /* ignore storage errors */
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { release, loading, error }
}
