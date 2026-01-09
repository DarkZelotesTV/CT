import { useEffect, useMemo, useState } from 'react';
import { Shield, Plus, Volume2, Users, Check, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { storage } from '../../shared/config/storage';
import { ModalLayout } from './ModalLayout';

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
  identity: new URL('../../assets/onboarding/identity-journey.svg', import.meta.url).toString(),
  servers: new URL('../../assets/onboarding/servers-journey.svg', import.meta.url).toString(),
  voice: new URL('../../assets/onboarding/voice-journey.svg', import.meta.url).toString(),
  settings: new URL('../../assets/onboarding/settings-journey.svg', import.meta.url).toString(),
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

  return (
    <ModalLayout
      title={t('onboarding.title')}
      description={t('onboarding.subtitle')}
      onClose={close}
      onOverlayClick={close}
      bodyClassName="grid lg:grid-cols-[1.1fr,0.9fr] gap-6 lg:gap-10 p-0"
    >
      <div className="flex flex-col gap-6 p-6 lg:p-8">
        <div className="relative overflow-hidden rounded-[var(--radius-5)] border border-[color:var(--color-border)]/70 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6 lg:p-7 shadow-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(125,211,252,0.12),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(129,140,248,0.2),transparent_30%)]" />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-[0.2em] text-text-muted">{welcomeLabel}</div>
                <h2 className="text-2xl lg:text-3xl font-bold text-text leading-tight">{t('onboarding.title')}</h2>
                <p className="text-sm text-text-muted max-w-2xl">{t('onboarding.subtitle')}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white/[0.04] px-3 py-1 text-xs text-text-muted">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-3)] bg-gradient-to-br from-white/10 to-white/0 border border-[color:var(--color-border)] text-[color:var(--color-accent)]">
                    <Icon size={18} />
                  </div>
                  <span className="font-semibold text-text">{progress}%</span>
                </div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{t('onboarding.progressTitle')}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-2 w-full rounded-full bg-[color:var(--color-surface-hover)] overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${progressColors[current.key]} transition-all duration-300`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
                <div className="flex items-center gap-2">
                  {steps.map((item, i) => {
                    const isActive = i === step;
                    const isDone = i < step;
                    return (
                      <div
                        key={item.key}
                        className={`flex items-center gap-2 rounded-full px-3 py-1 border text-[11px] uppercase tracking-[0.16em] ${
                          isActive
                            ? 'border-[color:var(--color-border-strong)]/80 bg-[color:var(--color-surface-hover)]/80 text-text'
                            : isDone
                            ? 'border-[color:var(--color-border-strong)]/50 bg-[color:var(--color-surface-hover)] text-text'
                            : 'border-[color:var(--color-border)]/70 bg-white/[0.02] text-text-muted'
                        }`}
                      >
                        <span className="font-semibold">{t('onboarding.progressLabel', { index: i + 1, total: steps.length })}</span>
                      </div>
                    );
                  })}
                </div>
                <span className="text-text-muted">{t('onboarding.stepCardHint')}</span>
              </div>
          </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {steps.map((item, i) => {
            const isActive = i === step;
            const isDone = i < step;
            const StatusIcon = isDone ? Check : item.icon;

            return (
              <button
                key={item.key}
                onClick={() => setStep(i)}
                className={`group flex w-full items-start gap-4 rounded-[var(--radius-4)] border px-4 py-4 transition-all text-left ${
                  isActive
                    ? 'border-[color:var(--color-border-strong)]/60 bg-[color:var(--color-surface-hover)]/80 shadow-lg shadow-[0_18px_30px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]'
                    : 'border-[color:var(--color-border)] bg-white/[0.03] hover:border-[color:var(--color-border-strong)] hover:bg-white/[0.07]'
                }`}
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-[var(--radius-3)] border ${
                    isActive
                      ? 'border-[color:var(--color-accent)]/60 bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)]'
                      : isDone
                      ? 'border-emerald-200/50 bg-emerald-500/15 text-emerald-100'
                      : 'border-[color:var(--color-border)] bg-[color:var(--color-surface-hover)] text-text-muted'
                  }`}
                >
                  <StatusIcon size={22} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-base font-semibold text-text">{t(item.titleKey)}</div>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        isActive
                          ? 'bg-[color:var(--color-accent)]/15 text-[color:var(--color-accent)] border border-[color:var(--color-accent)]/40'
                          : isDone
                          ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-200/40'
                          : 'bg-white/[0.04] text-text-muted border border-[color:var(--color-border)]'
                      }`}
                    >
                      {t(`onboarding.stepStatus.${isDone ? 'done' : isActive ? 'active' : 'upcoming'}`)}
                    </span>
                  </div>
                  <div className="text-sm text-text leading-relaxed">{t(item.bodyKey)}</div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{t('onboarding.progressLabel', { index: i + 1, total: steps.length })}</span>
                    <ArrowRight
                      size={14}
                      className={`transition-transform ${
                        isActive ? 'translate-x-1 text-[color:var(--color-accent)]' : 'group-hover:translate-x-1 text-text-muted'
                      }`}
                    />
                  </div>
                </div>
              </button>
            );
          })}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button className="px-4 py-2 rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-white/[0.04] text-text text-sm font-medium hover:border-[color:var(--color-border-strong)] hover:bg-white/[0.08]" onClick={finish}>
              {t('onboarding.skip')}
            </button>
            <button
              className="px-4 py-2 rounded-[var(--radius-3)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-[color:var(--color-on-accent)] text-sm font-semibold shadow-lg shadow-[0_16px_28px_color-mix(in_srgb,var(--color-accent)_30%,transparent)]"
              onClick={() => {
                if (step >= steps.length - 1) finish();
                else setStep((s) => s + 1);
              }}
            >
              {step >= steps.length - 1 ? t('onboarding.finish') : t('onboarding.next')}
            </button>
            <button
              className="px-4 py-2 rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-white/[0.03] text-text text-sm font-medium hover:border-[color:var(--color-border-strong)] hover:bg-white/[0.07]"
              onClick={() => {
                onStepAction?.(current.key);
                finish();
              }}
            >
              {t(`onboarding.actions.${current.key}`)}
            </button>
            <span className="text-xs text-text-muted">{t('onboarding.footerHint')}</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-none lg:rounded-l-[28px] border-t lg:border-t-0 lg:border-l border-[color:var(--color-border)]/70 bg-gradient-to-b from-white/[0.03] to-white/[0.01]">
        <div className="absolute -top-12 -right-10 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex h-full flex-col gap-4 p-6 lg:p-8">
          <div className="flex items-center justify-between text-sm text-text-muted">
            <span className="font-semibold">{t('onboarding.progressLabel', { index: step + 1, total: steps.length })}</span>
            <div className="flex items-center gap-2 text-text-muted">
              <Icon size={16} />
              <span>{t(current.titleKey)}</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-[var(--radius-5)] border border-[color:var(--color-border)]/70 shadow-2xl bg-gradient-to-br from-white/5 to-white/[0.02]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.2),transparent_35%)]" />
            <img
              src={current.visual}
              alt={t(current.titleKey)}
              className="relative w-full h-full object-cover mix-blend-screen"
            />
          </div>
          <div className="rounded-[var(--radius-4)] border border-[color:var(--color-border)]/70 bg-white/[0.03] p-3 text-xs text-text-muted">
            {t(current.bodyKey)}
          </div>
        </div>
      </div>
    </ModalLayout>
  );
};
