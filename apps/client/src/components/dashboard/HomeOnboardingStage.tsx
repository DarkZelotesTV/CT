import { ArrowRight, Compass, Home, Layers, MessageSquare, PlusCircle, Server, Settings, Users } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { DecorationLayer } from '../layout/DecorationLayer';
import { Button } from '../ui/Button';
import { Card, Icon } from '../ui';

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
              <div className="inline-flex h-6 items-center gap-2 px-2.5 py-1 rounded-full bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)] font-semibold uppercase tracking-wide text-[color:var(--color-text)]">
                <Icon icon={Home} size="sm" className="text-inherit" hoverTone="none" />
                Willkommen
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl min-[900px]:text-4xl min-[1200px]:text-5xl font-extrabold text-text leading-tight">
                  Starte in deine neue Homebase
                </h1>
                <p className="text-[length:var(--font-size-base)] min-[900px]:text-[length:var(--font-size-lg)] text-text-muted leading-[var(--line-height-base)] min-[900px]:leading-[var(--line-height-lg)] max-w-[50ch]">
                  Erstelle Server, organisiere Kanäle und lade dein Team ein. Diese Oberfläche bleibt dein Startpunkt, solange kein Server ausgewählt ist.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col min-[900px]:flex-row gap-3">
              <Button
                type="button"
                onClick={onCreateServer}
                variant="primary"
                className="h-10 px-4 rounded-[var(--radius-3)] shadow-lg shadow-[0_16px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)] gap-2.5 transition-colors max-[899px]:w-full max-[899px]:justify-center text-text"
              >
                <Icon icon={PlusCircle} size="lg" className="text-inherit" hoverTone="none" /> Server erstellen
              </Button>
              <Button
                type="button"
                onClick={onJoinServer}
                variant="secondary"
                className="h-10 px-4 rounded-[var(--radius-3)] gap-2.5 transition-colors max-[899px]:w-full max-[899px]:justify-center"
              >
                <Icon icon={Compass} size="lg" className="text-inherit" hoverTone="none" /> Mit Einladung beitreten
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-3 h-auto px-0 py-0 text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)] text-text-muted hover:text-[color:var(--color-accent)] self-start"
            >
              Demo-Server ansehen
            </Button>
            <div className="mt-5 flex flex-col gap-2 max-w-[400px]">
              {suggestedServers.slice(0, 3).map((server) => (
                <div
                  key={server.id}
                  className="flex h-10 items-center gap-3 rounded-[var(--radius-3)] border border-[color:var(--color-border)]/70 bg-surface-2 px-4"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-[color:var(--color-text)]">
                    <Icon icon={Server} size="md" className="text-inherit" hoverTone="none" />
                  </span>
                  <span className="text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)] font-medium text-text">{server.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="ml-auto h-10 rounded-[var(--radius-3)] px-4 text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)] font-semibold text-[color:var(--color-text)] hover:border-[color:var(--color-accent)]/40 hover:text-[color:var(--color-accent)]"
                  >
                    Beitreten
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-[600px]:grid-cols-3 gap-3">
            {steps.map(({ title, body, icon: StepIcon }) => (
              <Card
                key={title}
                variant="surface"
                className="bg-surface-2 hover:bg-surface-3 p-4 h-full flex flex-col gap-3 transition-colors"
              >
                <div className="w-9 h-9 rounded-[var(--radius-3)] bg-surface-3 border border-[color:var(--color-border)] text-[color:var(--color-text)] flex items-center justify-center">
                  <Icon icon={StepIcon} size="md" className="text-inherit" hoverTone="none" />
                </div>
                <div className="text-[length:var(--font-size-sm)] font-semibold text-text leading-snug">{title}</div>
                <p className="text-[length:var(--font-size-xs)] text-text-muted leading-[var(--line-height-base)] flex-1">{body}</p>
              </Card>
            ))}
          </div>
        </div>

        <Card
          variant="elevated"
          className="col-span-12 min-[960px]:col-span-5 bg-surface-2 hover:bg-surface-3 p-4 flex flex-col gap-4 transition-colors"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[var(--radius-3)] bg-surface-3 border border-[color:var(--color-border)] flex items-center justify-center text-[color:var(--color-text)]">
                <Icon icon={MessageSquare} size="lg" className="text-inherit" hoverTone="none" />
              </div>
              <div>
                <div className="text-[length:var(--font-size-lg)] leading-[var(--line-height-sm)] text-text font-semibold">Kein Server ausgewählt</div>
                <div className="text-[length:var(--font-size-sm)] leading-[var(--line-height-base)] text-text-muted">
                  Starte mit einem Server, um Kanäle anzulegen und dein Profil zu personalisieren.
                </div>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-3/70">
              <div className="h-full w-[28%] rounded-full bg-surface-3" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {checklistItems.map(({ label, icon: ItemIcon, action, disabled, tooltip }) => {
              const isDisabled = Boolean(disabled);
              return (
                <Button
                  key={label}
                  type="button"
                  onClick={isDisabled ? undefined : action}
                  aria-disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : 0}
                  title={isDisabled ? tooltip : undefined}
                  variant="ghost"
                  className={`group w-full h-10 items-center gap-3 rounded-[var(--radius-3)] border border-[color:var(--color-border)]/70 px-4 text-left transition justify-start ${
                    isDisabled
                      ? 'cursor-not-allowed bg-surface-2/30 text-text-muted/80'
                      : 'bg-surface-2 text-text hover:bg-surface-3 hover:border-[color:var(--color-accent)]/30 hover:ring-1 hover:ring-[color:var(--color-accent)]/15'
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[color:var(--color-text)]">
                    <Icon icon={ItemIcon} size="lg" className="text-inherit" hoverTone="none" />
                  </span>
                  <span className="text-[length:var(--font-size-sm)] leading-[var(--line-height-sm)] font-medium">{label}</span>
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)] transition ${
                      isDisabled
                        ? 'border-transparent text-text-muted/70'
                        : 'border-transparent text-text-muted group-hover:border-[color:var(--color-accent)]/20 group-hover:text-[color:var(--color-accent)]'
                    }`}
                  >
                    Los <Icon icon={ArrowRight} size="sm" className="text-inherit" hoverTone="none" />
                  </span>
                </Button>
              );
            })}
          </div>
          <Card variant="surface" className="bg-surface-3/60 p-4">
            <div className="text-[length:var(--font-size-xs)] leading-[var(--line-height-sm)] font-semibold uppercase tracking-wide text-text-muted mb-2">
              Bluesky
            </div>
            <iframe
              title="Bluesky Embed"
              src="https://bsky.app/profile/bsky.app/post/3l6nqav7jv22k"
              className="w-full h-56 rounded-[var(--radius-4)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
              loading="lazy"
            />
          </Card>
        </Card>
      </div>
    </div>
  );
};
