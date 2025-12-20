import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Plus, Volume2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getModalRoot } from './modalRoot';
import { storage } from '../../shared/config/storage';

interface Props {
  onClose: () => void;
  initialStep?: number;
  onStepAction?: (step: StepKey) => void;
}

type StepKey = 'identity' | 'servers' | 'voice' | 'settings';

type Step = { icon: any; titleKey: string; bodyKey: string; visual: string; key: StepKey };

const progressColors: Record<StepKey, string> = {
  identity: 'from-indigo-500 to-sky-400',
  servers: 'from-emerald-400 to-cyan-400',
  voice: 'from-sky-400 to-fuchsia-400',
  settings: 'from-fuchsia-500 to-blue-500',
};

const visuals: Record<StepKey, string> = {
  identity: new URL('../../assets/onboarding/identity.svg', import.meta.url).toString(),
  servers: new URL('../../assets/onboarding/servers.svg', import.meta.url).toString(),
  voice: new URL('../../assets/onboarding/voice.svg', import.meta.url).toString(),
  settings: new URL('../../assets/onboarding/settings.svg', import.meta.url).toString(),
};

export const OnboardingModal = ({ onClose, initialStep = 0, onStepAction }: Props) => {
  const { t } = useTranslation();
  const user = useMemo(() => storage.get('cloverUser'), []);

  const [step, setStep] = useState(initialStep);

  const steps: Step[] = [
    {
      key: 'identity',
      icon: Shield,
      titleKey: 'onboarding.steps.identity.title',
      bodyKey: 'onboarding.steps.identity.body',
      visual: visuals.identity,
    },
    {
      key: 'servers',
      icon: Plus,
      titleKey: 'onboarding.steps.servers.title',
      bodyKey: 'onboarding.steps.servers.body',
      visual: visuals.servers,
    },
    {
      key: 'voice',
      icon: Volume2,
      titleKey: 'onboarding.steps.voice.title',
      bodyKey: 'onboarding.steps.voice.body',
      visual: visuals.voice,
    },
    {
      key: 'settings',
      icon: Users,
      titleKey: 'onboarding.steps.settings.title',
      bodyKey: 'onboarding.steps.settings.body',
      visual: visuals.settings,
    },
  ];

  useEffect(() => {
    setStep(Math.min(initialStep, steps.length - 1));
  }, [initialStep, steps.length]);

  if (!steps.length) return null;

  const current = steps[Math.min(step, steps.length - 1)]!;
  const Icon = current.icon;
  const welcomeLabel = user?.username ? t('onboarding.welcomeUser', { username: user.username }) : t('onboarding.welcome');
  const progress = Math.round(((step + 1) / steps.length) * 100);

  const finish = () => {
    storage.set('onboardingDone', true);
    onClose();
  };

  const close = () => {
    // Also mark as done when user closes it.
    storage.set('onboardingDone', true);
    onClose();
  };

  const target = getModalRoot();
  if (!target) return null;

  return createPortal(
    <div
      className="fixed left-0 right-0 bottom-0 top-[var(--ct-titlebar-height)] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex: 2500, transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="w-full max-w-4xl bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
          aria-label={t('onboarding.close')}
        >
          <X size={20} />
        </button>

        <div className="grid lg:grid-cols-[1.2fr,1fr] gap-8 p-6 lg:p-8">
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <div className="text-xs uppercase tracking-widest text-gray-500">{welcomeLabel}</div>
              <div className="flex items-center gap-3 mt-1">
                <h2 className="text-2xl font-bold text-white">{t('onboarding.title')}</h2>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-indigo-200">
                    <Icon size={22} />
                  </div>
                  <span className="font-semibold">{progress}%</span>
                </div>
              </div>
              <p className="text-gray-400 text-sm mt-2">{t('onboarding.subtitle')}</p>
              <div className="mt-3">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${progressColors[current.key]} transition-all duration-300`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300"
                >
                  <Icon size={24} />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-white font-bold text-lg">{t(current.titleKey)}</div>
                  <div className="text-gray-300 text-sm leading-relaxed">{t(current.bodyKey)}</div>
                </div>
              </div>

              <div className="w-full rounded-2xl bg-white/[0.03] border border-white/5 p-4 flex items-center gap-4">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  {steps.map((item, i) => (
                    <button
                      key={item.key}
                      onClick={() => setStep(i)}
                      className={`text-left rounded-xl px-3 py-2 transition-all border ${
                        step === i
                          ? 'bg-white/10 border-white/20 shadow-lg shadow-indigo-900/20'
                          : 'bg-transparent border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-wide text-gray-400">{t(item.titleKey)}</div>
                      <div className="text-white/80 text-xs mt-1">{t('onboarding.progressLabel', { index: i + 1, total: steps.length })}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm"
                  onClick={finish}
                >
                  {t('onboarding.skip')}
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium"
                  onClick={() => {
                    if (step >= steps.length - 1) finish();
                    else setStep((s) => s + 1);
                  }}
                >
                  {step >= steps.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
                </button>
                <button
                  className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-sm font-medium"
                  onClick={() => {
                    onStepAction?.(current.key);
                    finish();
                  }}
                >
                  {t(`onboarding.actions.${current.key}`)}
                </button>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-indigo-600/20 blur-2xl" />
            <div className="absolute -bottom-8 -left-10 h-24 w-24 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-white/5 shadow-2xl bg-gradient-to-br from-white/5 to-white/[0.02]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.25),transparent_30%)]" />
              <img
                src={current.visual}
                alt={t(current.titleKey)}
                className="relative w-full h-full object-cover mix-blend-screen"
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    target
  );
};
