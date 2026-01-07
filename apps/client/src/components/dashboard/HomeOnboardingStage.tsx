import { ArrowRight, Compass, Home, Layers, MessageSquare, PlusCircle, Settings, Users } from 'lucide-react';

interface HomeOnboardingStageProps {
  onCreateServer: () => void;
  onJoinServer: () => void;
  onOpenSettings: () => void;
  hasServers: boolean;
}

export const HomeOnboardingStage = ({ onCreateServer, onJoinServer, onOpenSettings, hasServers }: HomeOnboardingStageProps) => {
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
  const checklistItems = [
    {
      label: 'Server erstellen',
      icon: PlusCircle,
      action: onCreateServer,
    },
    {
      label: 'Einladung eingeben',
      icon: Compass,
      action: onJoinServer,
    },
    {
      label: 'Profil einrichten',
      icon: Settings,
      action: onOpenSettings,
    },
    {
      label: 'Ersten Kanal erstellen',
      icon: MessageSquare,
      action: () => undefined,
      disabled: !hasServers,
      tooltip: 'Erstelle zuerst einen Server, um Kanäle anzulegen.',
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
              <div className="inline-flex h-7 items-center gap-2 px-2.5 py-1.5 rounded-full bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text)]">
                <Home size={14} />
                Willkommen
              </div>

              <div className="space-y-3">
                <h1 className="text-[32px] min-[900px]:text-[38px] min-[1200px]:text-[44px] font-extrabold text-white leading-[48px] min-[900px]:leading-[52px]">
                  Starte in deine neue Homebase
                </h1>
                <p className="text-[15px] min-[900px]:text-[16px] text-[color:var(--color-text-muted)] leading-[22px] min-[900px]:leading-[24px] max-w-[52ch]">
                  Erstelle Server, organisiere Kanäle und lade dein Team ein. Diese Oberfläche bleibt dein Startpunkt, solange kein Server ausgewählt ist.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col min-[900px]:flex-row gap-3">
              <button
                type="button"
                onClick={onCreateServer}
                className="h-11 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl shadow-lg shadow-[0_16px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] flex items-center gap-2.5 transition-colors max-[899px]:w-full max-[899px]:justify-center"
              >
                <PlusCircle size={18} /> Server erstellen
              </button>
              <button
                type="button"
                onClick={onJoinServer}
                className="h-11 px-4 bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 text-white rounded-xl border border-[color:var(--color-border)] flex items-center gap-2.5 transition-colors max-[899px]:w-full max-[899px]:justify-center"
              >
                <Compass size={18} /> Mit Einladung beitreten
              </button>
            </div>
            <button
              type="button"
              className="mt-3 text-[14px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-accent)] transition-colors self-start"
            >
              Demo-Server ansehen
            </button>
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

        <div className="col-span-12 min-[900px]:col-span-5 rounded-2xl border border-[color:var(--color-border)] bg-surface-alt p-[18px] min-[900px]:p-5 shadow-2xl flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-200">
                <MessageSquare size={20} />
              </div>
              <div>
                <div className="text-white font-semibold">Kein Server ausgewählt</div>
                <div className="text-[13px] text-[color:var(--color-text-muted)]">
                  Starte mit einem Server, um Kanäle anzulegen und dein Profil zu personalisieren.
                </div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[color:var(--color-surface-hover)]">
              <div className="h-full w-[28%] rounded-full bg-[color:var(--color-accent)]" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {checklistItems.map(({ label, icon: Icon, action, disabled, tooltip }) => {
              const isDisabled = Boolean(disabled);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={isDisabled ? undefined : action}
                  aria-disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : 0}
                  title={isDisabled ? tooltip : undefined}
                  className={`group flex h-11 items-center gap-3 rounded-xl border border-[color:var(--color-border)]/70 px-3 text-left transition ${
                    isDisabled
                      ? 'cursor-not-allowed bg-[color:var(--color-surface)]/30 text-[color:var(--color-text-muted)]/80'
                      : 'bg-[color:var(--color-surface)]/40 text-white hover:bg-[color:var(--color-surface-hover)] hover:border-[color:var(--color-accent)]/30 hover:ring-1 hover:ring-[color:var(--color-accent)]/15'
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text)]">
                    <Icon size={20} />
                  </span>
                  <span className="text-[14px] font-medium">{label}</span>
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] transition ${
                      isDisabled
                        ? 'border-transparent text-[color:var(--color-text-muted)]/70'
                        : 'border-transparent text-[color:var(--color-text-muted)] group-hover:border-[color:var(--color-accent)]/20 group-hover:text-[color:var(--color-accent)]'
                    }`}
                  >
                    Los <ArrowRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
