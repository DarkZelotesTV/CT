import { useEffect, useMemo, useState } from 'react';
import { Moon, Palette, Sparkles, Sun } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import { useSettings } from '../../context/SettingsContext';
import { applyAppTheme, applyDensitySettings, buildAppTheme } from '../../theme/appTheme';

const isValidHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export const ThemeLab = () => {
  const { settings, updateTheme } = useSettings();
  const { mode, accentColor, decorationsEnabled, density } = settings.theme;
  const [accentDraft, setAccentDraft] = useState(accentColor);

  useEffect(() => {
    setAccentDraft(accentColor);
  }, [accentColor]);

  useEffect(() => {
    const theme = buildAppTheme(mode, accentColor);
    applyAppTheme(theme);
    applyDensitySettings(density);
  }, [density, mode, accentColor]);

  const layoutSamples = useMemo(
    () => [
      { title: 'Channel Overview', desc: 'At-a-glance info for active rooms.' },
      { title: 'Member Status', desc: 'Visual tags for presence and roles.' },
      { title: 'Quick Actions', desc: 'Primary actions highlighted.' },
    ],
    [],
  );

  const handleAccentInput = (next: string) => {
    setAccentDraft(next);
    if (isValidHex(next)) {
      updateTheme({ accentColor: next });
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-[color:var(--color-text)] p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="space-y-3">
          <Badge variant="accent">Dev Theme Lab</Badge>
          <h1 className="text-3xl font-semibold">Theme controls & UI samples</h1>
          <p className="text-sm text-[color:var(--color-text-muted)] max-w-2xl">
            Use this playground to verify theming primitives, accent contrast, and decoration layers.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Palette size={16} /> Theme Mode
              </div>
              <div className="flex gap-2">
                <Button
                  variant={mode === 'light' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updateTheme({ mode: 'light' })}
                >
                  <Sun size={14} /> Light
                </Button>
                <Button
                  variant={mode === 'dark' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updateTheme({ mode: 'dark' })}
                >
                  <Moon size={14} /> Dark
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={16} /> Accent Color
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={isValidHex(accentDraft) ? accentDraft : accentColor}
                  onChange={(event) => handleAccentInput(event.target.value)}
                  aria-label="Accent color"
                  className="h-10 w-12 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0"
                />
                <Input
                  value={accentDraft}
                  onChange={(event) => handleAccentInput(event.target.value)}
                  placeholder="#6366F1"
                />
              </div>
              <div className="text-xs text-[color:var(--color-text-muted)]">
                Enter a hex value to see buttons, highlights, and badges update.
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Decorations</span>
                <Toggle
                  checked={decorationsEnabled ?? true}
                  onChange={(event) => updateTheme({ decorationsEnabled: event.target.checked })}
                />
              </div>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Toggle background orbs and extra highlight layers.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Buttons</h2>
                  <Badge variant="neutral">Primitives</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="success">Success</Button>
                  <Button variant="warning">Warning</Button>
                  <Button variant="danger">Danger</Button>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Inputs & Badges</h2>
                  <Badge variant="accent">UI</Badge>
                </div>
                <div className="space-y-3">
                  <Input placeholder="Search conversations" />
                  <Input placeholder="Invite by email" inputSize="lg" />
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="neutral">Default</Badge>
                    <Badge variant="accent">Accent</Badge>
                    <Badge variant="neutral" className="bg-[color:var(--color-surface-hover)]">
                      Muted
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Layout Snippets</h2>
                <Badge variant="neutral">Cards</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {layoutSamples.map((sample) => (
                  <div
                    key={sample.title}
                    className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{sample.title}</h3>
                      <Badge variant="accent">Live</Badge>
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">{sample.desc}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <Button size="sm" variant="primary">
                        View
                      </Button>
                      <Button size="sm" variant="secondary">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
