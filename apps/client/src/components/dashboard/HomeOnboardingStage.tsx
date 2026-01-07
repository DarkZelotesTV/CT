import { Compass, Home, Layers, MessageSquare, PlusCircle, Users } from 'lucide-react';

interface HomeOnboardingStageProps {
  onCreateServer: () => void;
  onJoinServer: () => void;
}

export const HomeOnboardingStage = ({ onCreateServer, onJoinServer }: HomeOnboardingStageProps) => {
  const steps = [
    {
      title: '1. Server entdecken oder erstellen',
      body: 'Starte mit einem eigenen Raum für deine Community oder tritt einem bestehenden Server per Invite bei.',
      icon: PlusCircle,
    },
    {
      title: '2. Erste Kanäle anlegen',
      body: 'Strukturiere Text-, Voice- oder Web-Kanäle für Projekte, Teams und Sessions.',
      icon: Layers,
    },
    {
      title: '3. Leute einladen',
      body: 'Lade Freunde oder Teammitglieder ein und bleib per Chat oder Voice in Kontakt.',
      icon: Users,
    },
  ];

  return (
    <div className="min-h-full w-full flex flex-col bg-gradient-to-br from-[#0b0b0f] via-[#0e0f18] to-[#0b0c12] relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
      <div className="absolute -right-32 -top-32 w-96 h-96 bg-indigo-600/20 blur-3xl rounded-full" />
      <div className="absolute -left-24 bottom-0 w-80 h-80 bg-green-500/10 blur-3xl rounded-full" />

      <div className="relative flex-1 grid grid-cols-12 gap-6 px-8 pt-10 pb-10 mx-auto max-w-full min-[900px]:max-w-[920px] min-[1200px]:max-w-[1040px] max-[899px]:px-5">
        <div className="col-span-12 min-[900px]:col-span-7 flex flex-col gap-6">
          <div className="flex flex-col">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] text-xs uppercase tracking-wide text-[color:var(--color-text)]">
                <Home size={14} />
                Willkommen
              </div>

              <div className="space-y-3">
                <h1 className="text-[32px] min-[900px]:text-[38px] min-[1200px]:text-[44px] font-bold text-white leading-tight">
                  Starte in deine neue Homebase
                </h1>
                <p className="text-[color:var(--color-text-muted)] text-base leading-relaxed">
                  Erstelle Server, organisiere Kanäle und lade dein Team ein. Diese Oberfläche bleibt dein Startpunkt, solange kein Server ausgewählt ist.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col min-[900px]:flex-row gap-3">
              <button
                type="button"
                onClick={onCreateServer}
                className="px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl shadow-lg shadow-[0_16px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] flex items-center gap-2 transition-colors max-[899px]:w-full max-[899px]:h-12 max-[899px]:justify-center"
              >
                <PlusCircle size={18} /> Server erstellen
              </button>
              <button
                type="button"
                onClick={onJoinServer}
                className="px-4 py-2.5 bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 text-white rounded-xl border border-[color:var(--color-border)] flex items-center gap-2 transition-colors max-[899px]:w-full max-[899px]:h-12 max-[899px]:justify-center"
              >
                <Compass size={18} /> Server beitreten
              </button>
            </div>
          </div>

          <div className="grid min-[600px]:grid-cols-3 gap-4">
            {steps.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="bg-white/[0.04] border border-[color:var(--color-border)]/70 rounded-2xl p-4 backdrop-blur-sm h-full flex flex-col gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-200 flex items-center justify-center">
                  <Icon size={18} />
                </div>
                <div className="text-sm font-semibold text-white leading-snug">{title}</div>
                <p className="text-xs text-[color:var(--color-text-muted)] leading-relaxed flex-1">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 min-[900px]:col-span-5 bg-white/[0.03] border border-[color:var(--color-border)]/70 rounded-2xl backdrop-blur-sm p-6 shadow-2xl flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-200">
              <MessageSquare size={24} />
            </div>
            <div>
              <div className="text-white font-semibold">Kein Server ausgewählt</div>
              <div className="text-xs text-[color:var(--color-text-muted)]">Nutze diese Übersicht, um deinen nächsten Schritt zu wählen.</div>
            </div>
          </div>

          <div className="bg-[color:var(--color-surface)]/50 border border-[color:var(--color-border)]/70 rounded-xl p-4 space-y-4">
            <div className="text-sm font-semibold text-white">Schnellstart</div>
            <ul className="text-xs text-[color:var(--color-text)] space-y-2 list-disc list-inside leading-relaxed">
              <li>Klicke auf das grüne Plus in der linken Leiste, um einen Server zu erstellen oder beizutreten.</li>
              <li>Lege Text-, Voice- oder Web-Kanäle an, um Teams zu organisieren.</li>
              <li>Nutze Server-Einstellungen für Rollen, Berechtigungen und Branding.</li>
            </ul>
          </div>

        </div>
      </div>
    </div>
  );
};
