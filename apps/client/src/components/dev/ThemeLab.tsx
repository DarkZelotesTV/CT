import { useEffect, useMemo, useState } from 'react';
import { Headphones, Mic, Moon, Palette, PhoneOff, Sparkles, Sun, Volume2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import { useSettings } from '../../context/SettingsContext';
import {
  MIN_ACCENT_CONTRAST,
  applyAppTheme,
  applyDensitySettings,
  buildAppTheme,
  getAccentContrastReport,
  getThemeContrastTargets,
} from '../../theme/appTheme';

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
  const contrastTargets = useMemo(() => getThemeContrastTargets(mode), [mode]);
  const accentContrast = useMemo(
    () => getAccentContrastReport(accentColor, contrastTargets.surface, contrastTargets.text, MIN_ACCENT_CONTRAST),
    [accentColor, contrastTargets.surface, contrastTargets.text],
  );
  const contrastRows = useMemo(
    () => [
      { label: 'Accent vs Surface', value: accentContrast.surfaceContrast },
      { label: 'Accent vs Text', value: accentContrast.textContrast },
      { label: 'Adjusted Accent vs Surface', value: accentContrast.adjustedSurfaceContrast },
      { label: 'Adjusted Accent vs Text', value: accentContrast.adjustedTextContrast },
    ],
    [
      accentContrast.adjustedSurfaceContrast,
      accentContrast.adjustedTextContrast,
      accentContrast.surfaceContrast,
      accentContrast.textContrast,
    ],
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

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Density</span>
                <Badge variant="neutral">{density}</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={density === 'comfortable' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updateTheme({ density: 'comfortable' })}
                >
                  Comfortable
                </Button>
                <Button
                  variant={density === 'compact' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => updateTheme({ density: 'compact' })}
                >
                  Compact
                </Button>
              </div>
              <p className="text-xs text-[color:var(--color-text-muted)]">
                Toggle spacing scale to preview compact layouts.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Contrast Metrics</h2>
                <Badge variant={accentContrast.meetsContrast ? 'success' : 'warning'}>
                  {accentContrast.meetsContrast ? 'Pass' : 'Fail'}
                </Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {contrastRows.map((row) => {
                  const passes = row.value >= MIN_ACCENT_CONTRAST;
                  return (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-semibold">{row.label}</p>
                        <p className="text-xs text-[color:var(--color-text-muted)]">
                          Ratio {row.value.toFixed(2)}
                        </p>
                      </div>
                      <Badge variant={passes ? 'success' : 'warning'}>{passes ? 'Pass' : 'Fail'}</Badge>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-[color:var(--color-text-muted)]">
                Target ratio: {MIN_ACCENT_CONTRAST}:1 for both surface and text.
              </div>
            </div>

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

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Accent & Density Preview</h2>
                <Badge variant="accent">Live</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Accent Highlights</span>
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[color:var(--color-text-muted)]">New</span>
                    <div className="flex-1 h-2 rounded-full bg-[color:var(--color-border)] overflow-hidden">
                      <div className="h-full w-2/3" style={{ backgroundColor: 'var(--color-accent)' }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="accent">Accent Tag</Badge>
                    <span className="text-xs text-[color:var(--color-text-muted)]">Primary CTA</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Density Scale</span>
                    <span className="text-xs text-[color:var(--color-text-muted)]">{density}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {['Invite teammates', 'Pin messages', 'Manage notifications'].map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                        style={{ padding: 'var(--space-2)' }}
                      >
                        <span className="text-xs font-semibold">{item}</span>
                        <Badge variant="neutral">Action</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Channel Items</h2>
                  <Badge variant="neutral">Panels</Badge>
                </div>
                <div className="space-y-2">
                  {['# onboarding', '# design-reviews', '# release-notes'].map((channel, index) => (
                    <div
                      key={channel}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                        index === 1
                          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-surface-alt)]'
                          : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'
                      }`}
                    >
                      <span className="text-sm font-semibold">{channel}</span>
                      <Badge variant={index === 1 ? 'accent' : 'neutral'}>{index === 1 ? 'Live' : '12'}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Member Row</h2>
                  <Badge variant="neutral">Panels</Badge>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Aria Flores', role: 'Admin', status: 'Online' },
                    { name: 'Theo Sparks', role: 'Moderator', status: 'Speaking' },
                  ].map((member, index) => (
                    <div
                      key={member.name}
                      className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[color:var(--color-border)] flex items-center justify-center text-xs font-semibold">
                          {member.name
                            .split(' ')
                            .map((chunk) => chunk[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{member.name}</p>
                          <p className="text-xs text-[color:var(--color-text-muted)]">{member.status}</p>
                        </div>
                      </div>
                      <Badge variant={index === 0 ? 'accent' : 'neutral'}>{member.role}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Modal Shell</h2>
                  <Badge variant="neutral">Panels</Badge>
                </div>
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Invite teammates</span>
                    <Badge variant="accent">New</Badge>
                  </div>
                  <p className="text-xs text-[color:var(--color-text-muted)]">
                    Share a personal invite link or copy the room token.
                  </p>
                  <div className="space-y-2">
                    <Input placeholder="Enter email address" />
                    <Input placeholder="Copy invite link" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary">
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary">
                      Send invite
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Voice Toolbar</h2>
                  <Badge variant="neutral">Panels</Badge>
                </div>
                <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-alt)] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[color:var(--color-border)] flex items-center justify-center">
                      <Headphones size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Voice Lounge</p>
                      <p className="text-xs text-[color:var(--color-text-muted)]">4 listeners • Live</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary">
                      <Mic size={14} />
                      Mute
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Volume2 size={14} />
                    </Button>
                    <Button size="sm" variant="danger">
                      <PhoneOff size={14} />
                      Leave
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
