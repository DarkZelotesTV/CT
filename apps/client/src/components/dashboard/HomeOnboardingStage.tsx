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

      <div className="relative flex-1 flex flex-col lg:flex-row items-stretch gap-8 px-6 py-8 lg:px-10 lg:py-12 justify-between">
        <div className="flex-1 space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs uppercase tracking-wide text-gray-300">
            <Home size={14} />
            Willkommen
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-bold text-white">Starte in deine neue Homebase</h1>
            <p className="text-gray-400 text-base leading-relaxed">
              Erstelle Server, organisiere Kanäle und lade dein Team ein. Diese Oberfläche bleibt dein Startpunkt, solange kein Server ausgewählt ist.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCreateServer}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-900/30 flex items-center gap-2 transition-colors"
            >
              <PlusCircle size={18} /> Server erstellen
            </button>
            <button
              type="button"
              onClick={onJoinServer}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 flex items-center gap-2 transition-colors"
            >
              <Compass size={18} /> Server beitreten
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-2">
            {steps.map(({ title, body, icon: Icon }) => (
              <div key={title} className="bg-white/[0.04] border border-white/5 rounded-2xl p-4 backdrop-blur-sm h-full flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-200 flex items-center justify-center">
                  <Icon size={18} />
                </div>
                <div className="text-sm font-semibold text-white leading-snug">{title}</div>
                <p className="text-xs text-gray-400 leading-relaxed flex-1">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full lg:w-[360px] bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-sm p-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-200">
              <MessageSquare size={24} />
            </div>
            <div>
              <div className="text-white font-semibold">Kein Server ausgewählt</div>
              <div className="text-xs text-gray-400">Nutze diese Übersicht, um deinen nächsten Schritt zu wählen.</div>
            </div>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="text-sm font-semibold text-white">Schnellstart</div>
            <ul className="text-xs text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
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
