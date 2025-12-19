import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Plus, Volume2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getModalRoot } from './modalRoot';
import { storage } from '../../shared/config/storage';

interface Props {
  onClose: () => void;
}

type Step = { icon: any; titleKey: string; bodyKey: string };

export const OnboardingModal = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const user = useMemo(() => storage.get('cloverUser'), []);

  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      icon: Shield,
      titleKey: 'onboarding.steps.identity.title',
      bodyKey: 'onboarding.steps.identity.body',
    },
    {
      icon: Plus,
      titleKey: 'onboarding.steps.servers.title',
      bodyKey: 'onboarding.steps.servers.body',
    },
    {
      icon: Volume2,
      titleKey: 'onboarding.steps.voice.title',
      bodyKey: 'onboarding.steps.voice.body',
    },
    {
      icon: Users,
      titleKey: 'onboarding.steps.settings.title',
      bodyKey: 'onboarding.steps.settings.body',
    },
  ];

  if (!steps.length) return null;

  const current = steps[Math.min(step, steps.length - 1)]!;
  const Icon = current.icon;
  const welcomeLabel = user?.username ? t('onboarding.welcomeUser', { username: user.username }) : t('onboarding.welcome');

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
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ zIndex: 2147483647, transform: 'translateZ(0)', willChange: 'transform' }}
    >
      <div className="w-full max-w-lg bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10"
          aria-label={t('onboarding.close')}
        >
          <X size={20} />
        </button>

        <div className="p-6 border-b border-white/5">
          <div className="text-xs uppercase tracking-widest text-gray-500">{welcomeLabel}</div>
          <h2 className="text-2xl font-bold text-white mt-1">{t('onboarding.title')}</h2>
          <p className="text-gray-400 text-sm mt-1">{t('onboarding.subtitle')}</p>
        </div>

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
              <Icon size={24} />
            </div>
            <div className="flex-1">
              <div className="text-white font-bold">{t(current.titleKey)}</div>
              <div className="text-gray-400 text-sm mt-1 leading-relaxed">{t(current.bodyKey)}</div>
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
            </div>
          </div>
        </div>
      </div>
    </div>,
    target
  );
};
