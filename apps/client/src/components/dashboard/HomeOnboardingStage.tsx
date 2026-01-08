import { ArrowRight, Compass, Home, Layers, MessageSquare, PlusCircle, Server, Settings, Users } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { DecorationLayer } from '../layout/DecorationLayer';

interface HomeOnboardingStageProps {
  onCreateServer: () => void;
  onJoinServer: () => void;
  onOpenSettings: () => void;
  hasServers: boolean;
}

export const HomeOnboardingStage = ({ onCreateServer, onJoinServer, onOpenSettings, hasServers }: HomeOnboardingStageProps) => {
  const { settings } = useSettings();
  const decorationsEnabled = settings.theme.decorationsEnabled ?? true;
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
  // TODO: Replace with real server discovery data once available.
  const suggestedServers = [
    { id: 'design-lounge', name: 'Design Lounge' },
    { id: 'dev-collective', name: 'Dev Collective' },
  ];

  return (
    <div className="min-h-full w-full flex flex-col bg-background relative overflow-hidden">
      <DecorationLayer enabled={decorationsEnabled} />

      <div className="relative z-10 flex-1 grid grid-cols-12 gap-6 mx-auto w-full max-w-[1120px] p-4 min-[640px]:p-6">
        <div className="col-span-12 min-[960px]:col-span-7 flex flex-col gap-6">
          <div className="flex flex-col">
            <div className="flex flex-col gap-3">
              <div className="inline-flex h-6 items-center gap-2 px-2.5 py-1 rounded-full bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text)]">
                <Home size={14} />
                Willkommen
              </div>

              <div className="space-y-3">
                <h1 className="text-[30px] min-[900px]:text-[36px] min-[1200px]:text-[40px] font-extrabold text-text leading-[44px] min-[900px]:leading-[48px]">
                  Starte in deine neue Homebase
                </h1>
                <p className="text-[14px] min-[900px]:text-[15px] text-text-muted leading-[21px] min-[900px]:leading-[23px] max-w-[50ch]">
                  Erstelle Server, organisiere Kanäle und lade dein Team ein. Diese Oberfläche bleibt dein Startpunkt, solange kein Server ausgewählt ist.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col min-[900px]:flex-row gap-3">
              <button
                type="button"
                onClick={onCreateServer}
                className="h-10 px-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-text rounded-2xl shadow-lg shadow-[0_16px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] flex items-center gap-2.5 transition-colors max-[899px]:w-full max-[899px]:justify-center"
              >
                <PlusCircle size={18} /> Server erstellen
              </button>
              <button
                type="button"
                onClick={onJoinServer}
                className="h-10 px-4 bg-[color:var(--color-surface-hover)] hover:bg-[color:var(--color-surface-hover)]/80 text-text rounded-2xl border border-[color:var(--color-border)] flex items-center gap-2.5 transition-colors max-[899px]:w-full max-[899px]:justify-center"
              >
                <Compass size={18} /> Mit Einladung beitreten
              </button>
            </div>
            <button
              type="button"
              className="mt-3 text-[13px] text-text-muted hover:text-[color:var(--color-accent)] transition-colors self-start"
            >
              Demo-Server ansehen
            </button>
            <div className="mt-5 flex flex-col gap-2 max-w-[400px]">
              {suggestedServers.slice(0, 3).map((server) => (
                <div
                  key={server.id}
                  className="flex h-10 items-center gap-3 rounded-2xl border border-[color:var(--color-border)]/70 bg-surface-2 px-4"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-[color:var(--color-text)]">
                    <Server size={16} />
                  </span>
                  <span className="text-[13px] font-medium text-text">{server.name}</span>
                  <button
                    type="button"
                    className="ml-auto inline-flex h-10 items-center rounded-2xl border border-[color:var(--color-border)] px-4 text-[12px] font-semibold text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-accent)]/40 hover:text-[color:var(--color-accent)]"
                  >
                    Beitreten
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-[600px]:grid-cols-3 gap-3">
            {steps.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="bg-surface-2 hover:bg-surface-3 border border-[color:var(--color-border)]/70 rounded-2xl p-4 backdrop-blur-sm h-full flex flex-col gap-3 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-surface-3 border border-[color:var(--color-border)] text-[color:var(--color-text)] flex items-center justify-center">
                  <Icon size={17} />
                </div>
                <div className="text-[13px] font-semibold text-text leading-snug">{title}</div>
                <p className="text-[11px] text-text-muted leading-relaxed flex-1">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 min-[960px]:col-span-5 rounded-2xl border border-[color:var(--color-border)] bg-surface-2 hover:bg-surface-3 p-4 shadow-2xl flex flex-col gap-4 transition-colors">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-surface-3 border border-[color:var(--color-border)] flex items-center justify-center text-[color:var(--color-text)]">
                <MessageSquare size={18} />
              </div>
              <div>
                <div className="text-[15px] text-text font-semibold">Kein Server ausgewählt</div>
                <div className="text-[12px] text-text-muted">
                  Starte mit einem Server, um Kanäle anzulegen und dein Profil zu personalisieren.
                </div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3/70">
              <div className="h-full w-[28%] rounded-full bg-surface-3" />
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
                  className={`group flex h-10 items-center gap-3 rounded-2xl border border-[color:var(--color-border)]/70 px-4 text-left transition ${
                    isDisabled
                      ? 'cursor-not-allowed bg-surface-2/30 text-text-muted/80'
                      : 'bg-surface-2 text-text hover:bg-surface-3 hover:border-[color:var(--color-accent)]/30 hover:ring-1 hover:ring-[color:var(--color-accent)]/15'
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[color:var(--color-text)]">
                    <Icon size={18} />
                  </span>
                  <span className="text-[13px] font-medium">{label}</span>
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition ${
                      isDisabled
                        ? 'border-transparent text-text-muted/70'
                        : 'border-transparent text-text-muted group-hover:border-[color:var(--color-accent)]/20 group-hover:text-[color:var(--color-accent)]'
                    }`}
                  >
                    Los <ArrowRight size={14} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-surface-3/60 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
              Bluesky
            </div>
            <iframe
              title="Bluesky Embed"
              src="https://bsky.app/profile/bsky.app/post/3l6nqav7jv22k"
              className="w-full h-[220px] rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
