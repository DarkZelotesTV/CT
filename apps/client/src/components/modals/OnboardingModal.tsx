import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Plus, Volume2, Users } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const STORAGE_KEY = 'ct.onboarding.v1.done';

type Step = { icon: any; title: string; body: string };

export const OnboardingModal = ({ onClose }: Props) => {
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('clover_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      icon: Shield,
      title: 'Deine Clover Identity',
      body: 'Deine Identität liegt lokal auf deinem Gerät. Du kannst sie jederzeit exportieren (Backup) oder importieren. Ohne Identity kannst du keinen Server beitreten.',
    },
    {
      icon: Plus,
      title: 'Server erstellen oder beitreten',
      body: 'Über das grüne + links kannst du Server erstellen oder Server beitreten – auch von anderen Instanzen. Remote Server werden automatisch „gepinnt“.',
    },
    {
      icon: Volume2,
      title: 'Voice Calls',
      body: 'Klicke auf einen Voice-Channel um zu verbinden. Unter dem Call siehst du, wer im Talk ist – und wer gerade spricht.',
    },
    {
      icon: Users,
      title: 'Server Settings & Rollen',
      body: 'Als Admin kannst du Kanäle erstellen, Rollen vergeben und Berechtigungen pro Kanal einstellen. Öffne die Server Settings über das Zahnrad am Servernamen.',
    },
  ];

  const current = steps[Math.min(step, steps.length - 1)];
  const Icon = current.icon;

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onClose();
  };

  const close = () => {
    // Also mark as done when user closes it.
    localStorage.setItem(STORAGE_KEY, '1');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>

        <div className="p-6 border-b border-white/5">
          <div className="text-xs uppercase tracking-widest text-gray-500">Willkommen{user?.username ? `, ${user.username}` : ''}</div>
          <h2 className="text-2xl font-bold text-white mt-1">Kurzes Tutorial</h2>
          <p className="text-gray-400 text-sm mt-1">In 30 Sekunden bist du startklar.</p>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
              <Icon size={24} />
            </div>
            <div className="flex-1">
              <div className="text-white font-bold">{current.title}</div>
              <div className="text-gray-400 text-sm mt-1 leading-relaxed">{current.body}</div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-indigo-400/80' : 'bg-white/10'}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm"
                onClick={finish}
              >
                Überspringen
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                onClick={() => {
                  if (step >= steps.length - 1) finish();
                  else setStep((s) => s + 1);
                }}
              >
                {step >= steps.length - 1 ? 'Los geht\'s' : 'Weiter'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
