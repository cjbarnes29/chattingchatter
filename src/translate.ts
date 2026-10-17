/** Translation and transcription that stay on the device where possible.
 *  - Translation uses the browser's built-in on-device Translator (Chrome on computers, version 138+).
 *    Nothing is sent to a translation service. Where it isn't built in, we say so instead of guessing.
 *  - Transcripts use the browser's speech recognition while you record (only if you turn it on, because
 *    in Chrome that service runs on Google's servers). Android's in-app web view doesn't offer it. */

type Availability = 'unavailable' | 'downloadable' | 'downloading' | 'available'
type TranslatorApi = {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<{ translate(t: string): Promise<string>; destroy?: () => void }>
}
type DetectorApi = { create(): Promise<{ detect(t: string): Promise<{ detectedLanguage: string; confidence: number }[]> }> }

const g = globalThis as unknown as { Translator?: TranslatorApi; LanguageDetector?: DetectorApi }

export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' }, { code: 'es', name: 'Spanish' }, { code: 'fr', name: 'French' }, { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' }, { code: 'pt', name: 'Portuguese' }, { code: 'nl', name: 'Dutch' }, { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' }, { code: 'ru', name: 'Russian' }, { code: 'uk', name: 'Ukrainian' }, { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' }, { code: 'bn', name: 'Bengali' }, { code: 'zh', name: 'Chinese' }, { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' }, { code: 'vi', name: 'Vietnamese' }, { code: 'th', name: 'Thai' }, { code: 'id', name: 'Indonesian' },
  { code: 'fil', name: 'Filipino' }, { code: 'sw', name: 'Swahili' },
]

export const baseLang = (tag: string | undefined) => (tag || '').split('-')[0].toLowerCase()
export const deviceLang = () => baseLang(typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en'
export const translationSupported = () => typeof g.Translator?.create === 'function'

export type TranslateResult = { ok: true; text: string } | { ok: false; error: string }

export async function translateText(text: string, from: string | undefined, to: string): Promise<TranslateResult> {
  const T = g.Translator
  if (!T) return { ok: false, error: 'This device doesn’t offer on-device translation yet. It works in Chrome on a computer.' }
  let source = baseLang(from)
  if (!source && g.LanguageDetector) {
    try {
      const d = await (await g.LanguageDetector.create()).detect(text)
      source = d[0]?.detectedLanguage ?? ''
    } catch {
      /* fall through */
    }
  }
  if (!source) return { ok: false, error: 'Couldn’t tell which language this is.' }
  if (source === to) return { ok: true, text }
  let needsDownload = false
  const work = (async (): Promise<TranslateResult> => {
    const av = await T.availability({ sourceLanguage: source, targetLanguage: to })
    if (av === 'unavailable') return { ok: false, error: 'That language pair isn’t available on this device.' }
    needsDownload = av !== 'available'
    const tr = await T.create({ sourceLanguage: source, targetLanguage: to })
    const out = await tr.translate(text)
    tr.destroy?.()
    return { ok: true, text: out }
  })()
  // the browser may need to download a language pack first, which can stall without a connection
  const timeout = new Promise<TranslateResult>((resolve) =>
    setTimeout(() => resolve({ ok: false, error: needsDownload ? 'The language pack is still downloading. Try again in a minute, with an internet connection.' : 'Translation is taking too long. Try again.' }), TRANSLATE_TIMEOUT_MS),
  )
  try {
    return await Promise.race([work, timeout])
  } catch {
    return { ok: false, error: 'Translation didn’t work this time. Try again.' }
  }
}
export const TRANSLATE_TIMEOUT_MS = 15_000

// ---------- live transcript while recording ----------
type Rec = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }
const SR = () => (globalThis as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition
  ?? (globalThis as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition

export const transcriptionSupported = () => !!SR()

/** Starts listening; stop() resolves with what was heard (possibly empty). Never throws. */
export function startTranscript(lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US') {
  const Ctor = SR()
  let finalText = ''
  let interim = ''
  let rec: Rec | null = null
  let ended = !Ctor
  let wantRun = true
  const done: (() => void)[] = []
  if (Ctor) {
    try {
      rec = new Ctor()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = (e) => {
        interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finalText += r[0].transcript
          else interim += r[0].transcript
        }
      }
      rec.onerror = () => {}
      // Chrome stops after silences; restart while still recording
      rec.onend = () => {
        if (wantRun) { try { rec?.start(); return } catch { /* give up */ } }
        ended = true
        done.splice(0).forEach((f) => f())
      }
      rec.start()
    } catch {
      ended = true
    }
  }
  return {
    lang,
    stop(): Promise<string> {
      wantRun = false
      return new Promise((resolve) => {
        const finish = () => resolve((finalText + ' ' + interim).replace(/\s+/g, ' ').trim())
        if (ended || !rec) return finish()
        done.push(finish)
        try { rec.stop() } catch { finish() }
        setTimeout(finish, 1500) // don't hang if the service never answers
      })
    },
    cancel() {
      wantRun = false
      try { rec?.abort() } catch { /* ignore */ }
    },
  }
}

// ---------- the sender's transcript preference (off by default) ----------
const TX_KEY = 'chatter.voice.transcribe'
export const readTranscribe = () => { try { return localStorage.getItem(TX_KEY) === '1' } catch { return false } }
export const setTranscribe = (on: boolean) => { try { localStorage.setItem(TX_KEY, on ? '1' : '0') } catch { /* ignore */ } }
