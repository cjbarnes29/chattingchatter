import { ArrowLeft } from 'lucide-react'

export const TERMS_UPDATED = '15 October 2026'
export const CONTACT_EMAIL = 'support@chatter.app'

const sections: { title: string; body: string[] }[] = [
  {
    title: '1. Who can use Chatter',
    body: [
      'You must be at least 13 years old (or the minimum age in your country) to create an account.',
      'You are responsible for keeping your password and PIN private. Tell us straight away if you think someone else has accessed your account.',
      'Give accurate information in your profile. Do not impersonate another person or organisation.',
    ],
  },
  {
    title: '2. Acceptable use',
    body: [
      'Do not send threats, harassment, hate content, sexual content involving minors, scams, malware or spam.',
      'Do not use Chatter to break the law or to infringe other people’s rights.',
      'Do not try to break, overload or reverse engineer the service, or access other users’ data.',
      'We may suspend or delete accounts that break these rules.',
    ],
  },
  {
    title: '3. Your messages and privacy',
    body: [
      'Messages, calls, stories, group chats and Ghost Canvas content are stored so the service can deliver them. You control what you share.',
      'Read receipts, presence (online/offline status) and profile details can be changed in Settings. Some features, such as a status you choose to fake, only change what other people see.',
      'Chatter is not end-to-end encrypted unless a feature says so explicitly. Do not share anything you would not want stored on our servers.',
      'Our Privacy Policy explains what data we collect and how we use it.',
    ],
  },
  {
    title: '4. Ghost Canvas and decoy mode',
    body: [
      'Ghost Canvas rooms, notes and vanish timers are provided as a privacy convenience. Anyone in a room can still copy or screenshot what they see.',
      'Decoy mode and biometric unlock are features that help keep your chats private on your own device. They are not a guarantee against someone who has your phone unlocked or knows your passwords.',
    ],
  },
  {
    title: '5. Chatter Pro and payments',
    body: [
      'Chatter Pro is a paid subscription that unlocks extra features. Prices and trial terms are shown in the app before you pay.',
      'Subscriptions renew automatically until cancelled. You can cancel at any time from Settings; access continues until the end of the paid period.',
      'Payments are handled by our payment provider. We do not store your full card details.',
    ],
  },
  {
    title: '6. Your content',
    body: [
      'You keep ownership of what you post. By posting it you give Chatter permission to store and deliver it to the people you choose to share it with.',
      'You can delete your messages, stories and account. Some copies may remain in backups for a limited time.',
    ],
  },
  {
    title: '7. Account deletion',
    body: [
      'You can delete your account from Settings. Your profile and chats are removed from our servers within a reasonable period.',
      'Messages already delivered to other people are not removed from their devices by us.',
    ],
  },
  {
    title: '8. No warranty and limits of liability',
    body: [
      'Chatter is provided “as is”. We work hard to keep it running, but we cannot promise it will always be available, error-free or secure.',
      'To the extent the law allows, Chatter is not liable for indirect or consequential losses arising from your use of the service.',
    ],
  },
  {
    title: '9. Changes to these terms',
    body: [
      'We may update these terms. If changes are significant, we will tell you in the app. Continuing to use Chatter after an update means you accept the new terms.',
    ],
  },
  {
    title: '10. Contact',
    body: [`Questions about these terms? Email ${CONTACT_EMAIL}.`],
  },
]

/** Full-screen Terms and Conditions page. `onBack` returns to the previous screen. */
export default function Terms({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[rgb(var(--bg-app))] text-[rgb(var(--text-primary))]">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[rgb(var(--accent))] transition hover:opacity-80"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight">Terms and Conditions</h1>
        <p className="mt-1 text-sm text-[rgb(var(--text-tertiary))]">Last updated {TERMS_UPDATED}</p>
        <p className="mt-5 text-[15px] leading-relaxed text-[rgb(var(--text-secondary))]">
          These terms explain the rules for using Chatter. Please read them carefully. They are written in plain language, but they are a legal agreement between you and Chatter.
        </p>

        <div className="mt-8 space-y-7">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold">{s.title}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-[rgb(var(--text-secondary))]">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
