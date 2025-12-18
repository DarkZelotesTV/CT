import { useEffect, useMemo, useState } from 'react';
import { Globe, Edit, Save, X, LayoutGrid, Columns, Image, FileInput, Eye } from 'lucide-react';
import { apiFetch } from '../../api/http';

interface WebChannelViewProps {
  channelId: number;
  channelName: string;
}

type LayoutMode = 'stack' | 'two-column' | 'grid';

const LAYOUT_CLASSES: Record<LayoutMode, string> = {
  stack: 'space-y-6',
  'two-column': 'grid md:grid-cols-2 gap-6',
  grid: 'grid md:grid-cols-3 gap-6'
};

const layoutClassNameSet = new Set(
  Object.values(LAYOUT_CLASSES)
    .join(' ')
    .split(' ')
    .filter(Boolean)
);

const RowsPreview = () => (
  <div className="flex flex-col gap-0.5 w-4 h-4 text-gray-300">
    <span className="block h-1 w-full rounded-sm bg-current" />
    <span className="block h-1 w-full rounded-sm bg-current" />
    <span className="block h-1 w-3/4 rounded-sm bg-current" />
  </div>
);

const layoutOptions: { key: LayoutMode; label: string; description: string; icon: JSX.Element }[] = [
  {
    key: 'stack',
    label: 'Abschnitte',
    description: 'Gestapelte Sektionen mit viel Weißraum',
    icon: <RowsPreview />
  },
  {
    key: 'two-column',
    label: '2-Spalten',
    description: 'Text und Widgets nebeneinander',
    icon: <Columns size={16} />
  },
  {
    key: 'grid',
    label: 'Karten-Grid',
    description: 'Mehrere Elemente in einem Raster',
    icon: <LayoutGrid size={16} />
  }
];

const widgetSnippets: Record<string, string> = {
  media: `<div class="media-embed" data-widget="media">
  <iframe class="w-full aspect-video rounded-lg" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Embedded media" allowfullscreen></iframe>
</div>`,
  form: `<form class="bg-dark-200 p-4 rounded-lg space-y-3" data-widget="form">
  <label class="block text-sm font-semibold">Kontakt</label>
  <input class="w-full bg-dark-100 border border-dark-400 rounded px-3 py-2" placeholder="Ihre E-Mail" />
  <textarea class="w-full bg-dark-100 border border-dark-400 rounded px-3 py-2" rows="3" placeholder="Nachricht"></textarea>
  <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Senden</button>
</form>`,
  file: `<a data-widget="file" href="/files/beispiel.pdf" class="flex items-center gap-2 text-blue-200 hover:text-blue-100 underline">
  📄 Datei herunterladen
</a>`
};

const placeholderHtml = '<div class="text-center text-gray-500 mt-10"><h1>Willkommen</h1><p>Diese Seite ist noch leer.</p></div>';

export const WebChannelView = ({ channelId, channelName }: WebChannelViewProps) => {
  const [htmlContent, setHtmlContent] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('stack');
  const [layoutExtras, setLayoutExtras] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const buildDocument = (body: string, layout: LayoutMode, extras = '') => {
    const layoutClassNames = ['web-channel-layout', LAYOUT_CLASSES[layout], extras]
      .filter(Boolean)
      .join(' ');
    const safeBody = body?.trim() ? body : placeholderHtml;
    const layoutWrapperPattern = /<[^>]*data-layout=/;

    if (layoutWrapperPattern.test(body)) {
      return body;
    }

    return `<section data-layout="${layout}" class="${layoutClassNames}">${safeBody}</section>`;
  };

  const parseContent = (content?: string) => {
    if (!content) {
      return { layout: 'stack' as LayoutMode, body: '', extras: '' };
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const layoutNode = doc.querySelector('[data-layout]');

      if (layoutNode) {
        const detectedLayout = (layoutNode.getAttribute('data-layout') as LayoutMode) || 'stack';
        const extraClassNames = Array.from(layoutNode.classList)
          .filter((className) => className !== 'web-channel-layout' && !layoutClassNameSet.has(className))
          .join(' ');

        return {
          layout: (['stack', 'two-column', 'grid'].includes(detectedLayout) ? detectedLayout : 'stack') as LayoutMode,
          body: layoutNode.innerHTML?.trim() || '',
          extras: extraClassNames
        };
      }

      return { layout: 'stack' as LayoutMode, body: content, extras: '' };
    } catch (err) {
      console.error('Parsing error', err);
      return { layout: 'stack' as LayoutMode, body: content, extras: '' };
    }
  };

  const previewContent = useMemo(
    () => buildDocument(editValue, layoutMode, layoutExtras),
    [editValue, layoutMode, layoutExtras]
  );

  const validateContent = (html: string, rawBody: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const parserError = doc.querySelector('parsererror');

    const strippedText = rawBody.replace(/<[^>]*>/g, '').trim();
    const hasInteractiveElements = /<(iframe|video|audio|form|input|textarea|select|button|img)[^>]*>/i.test(rawBody);
    const hasLinks = /<a\s[^>]*href=/i.test(rawBody);

    if (!strippedText && !hasInteractiveElements && !hasLinks) {
      return 'Der Inhalt darf nicht leer sein. Bitte füge Text, ein Widget oder einen Link hinzu.';
    }

    if (parserError) {
      return 'Der HTML-Inhalt enthält Fehler. Bitte prüfen Sie Ihre Tags.';
    }

    return null;
  };

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ content?: string }>(`/api/channels/${channelId}/content`);
        const { layout, body, extras } = parseContent(data?.content);
        const wrappedContent = buildDocument(body, layout, extras);

        setLayoutMode(layout);
        setLayoutExtras(extras);
        setContentBody(body);
        setHtmlContent(wrappedContent);
        setEditValue(body);
        setIsEditing(false);
      } catch (err: any) {
        setError(err?.message || 'Fehler beim Laden des Inhalts');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [channelId]);

  // Speichern
  const handleSave = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    const layoutContent = buildDocument(editValue, layoutMode, layoutExtras);
    const validationMessage = validateContent(layoutContent, editValue);

    if (validationMessage) {
      setError(validationMessage);
      setLoading(false);
      return;
    }

    try {
      const data = await apiFetch<{ content?: string }>(
        `/api/channels/${channelId}/content`,
        { method: 'PUT', body: JSON.stringify({ content: layoutContent }) }
      );
      const updatedContent = data?.content ?? layoutContent;
      const { layout, body, extras } = parseContent(updatedContent);
      const wrapped = buildDocument(body, layout, extras);

      setLayoutMode(layout);
      setLayoutExtras(extras);
      setContentBody(body);
      setHtmlContent(wrapped);
      setEditValue(body);
      setIsEditing(false);
      setStatusMessage('Änderungen erfolgreich gespeichert.');
    } catch (err) {
      const message = (err as any)?.message || 'Fehler beim Speichern';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const appendSnippet = (snippet: string) => {
    setEditValue((current) => `${current?.trim() ? `${current}\n\n` : ''}${snippet}`);
  };

  const layoutBadge = (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isEditing ? 'bg-blue-500/20 text-blue-200 border border-blue-500/50' : 'bg-dark-300 text-gray-300 border border-dark-400'}`}>
      {isEditing ? 'Edit Mode' : 'Read-only'}
    </span>
  );

  const activeLayout = layoutOptions.find((option) => option.key === layoutMode);

  return (
    <div className="flex-1 flex flex-col bg-dark-100 relative z-0 h-full overflow-hidden">

      {/* Header */}
      <div className="h-12 border-b border-dark-400 flex items-center px-4 shadow-sm bg-dark-100 flex-shrink-0 justify-between">
        <div className="flex items-center gap-3">
          <Globe className="text-gray-400" size={20} />
          <span className="font-bold text-white mr-2">{channelName}</span>
          {layoutBadge}
        </div>

        {/* Edit Button (Nur für Admins sichtbar machen später) */}
        <div className="flex items-center gap-3">
          {statusMessage && !isEditing && (
            <span className="text-green-300 text-xs bg-green-900/50 px-3 py-1 rounded-full border border-green-700">
              {statusMessage}
            </span>
          )}
          <button
            onClick={() => {
              if (!isEditing) setEditValue(contentBody || '<h1>Willkommen!</h1><p>Bearbeite mich...</p>');
              setIsEditing(!isEditing);
              setStatusMessage(null);
              setError(null);
            }}
            className={`flex items-center gap-2 text-xs uppercase font-bold px-3 py-2 rounded border transition ${
              isEditing
                ? 'text-red-200 border-red-400/40 hover:border-red-300'
                : 'text-gray-200 border-dark-400 hover:border-dark-200'
            }`}
          >
            {isEditing ? <X size={16} /> : <Edit size={16} />}
            {isEditing ? 'Abbrechen' : 'Seite bearbeiten'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 text-red-100 text-sm px-4 py-2 border-b border-red-800">
          {error}
        </div>
      )}

      {statusMessage && isEditing && !error && (
        <div className="bg-blue-900/40 text-blue-100 text-sm px-4 py-2 border-b border-blue-800 flex items-center gap-2">
          <Eye size={14} /> {statusMessage}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">

        {isEditing ? (
          <div className="flex flex-col h-full p-4 gap-4">
            <div className="bg-dark-200 border border-dark-400 rounded-lg p-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Layout & Vorschau</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {layoutOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setLayoutMode(option.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition ${
                          layoutMode === option.key
                            ? 'bg-blue-600/20 border-blue-500 text-blue-100'
                            : 'bg-dark-300 border-dark-400 text-gray-200 hover:border-dark-200'
                        }`}
                      >
                        {option.icon}
                        <div className="text-left">
                          <div className="font-semibold leading-4">{option.label}</div>
                          <div className="text-[11px] text-gray-400 leading-4">{option.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-[220px]">
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Widgets einfügen</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => appendSnippet(widgetSnippets.media)}
                      className="flex items-center gap-2 px-3 py-2 rounded border border-dark-400 text-gray-200 hover:border-dark-200 bg-dark-300 text-sm"
                    >
                      <Image size={16} /> Media-Embed
                    </button>
                    <button
                      onClick={() => appendSnippet(widgetSnippets.form)}
                      className="flex items-center gap-2 px-3 py-2 rounded border border-dark-400 text-gray-200 hover:border-dark-200 bg-dark-300 text-sm"
                    >
                      <Edit size={16} /> Formular
                    </button>
                    <button
                      onClick={() => appendSnippet(widgetSnippets.file)}
                      className="flex items-center gap-2 px-3 py-2 rounded border border-dark-400 text-gray-200 hover:border-dark-200 bg-dark-300 text-sm"
                    >
                      <FileInput size={16} /> Datei-Link
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                <Eye size={14} /> Layout-Vorschau zeigt Raster- oder Abschnittsstruktur live an.
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 flex-1 min-h-0">
              <div className="flex flex-col h-full">
                <label className="text-sm text-gray-300 font-semibold mb-2">HTML-Editor</label>
                <textarea
                  className="flex-1 bg-dark-300 text-gray-200 font-mono p-4 rounded outline-none border border-dark-400 resize-none text-sm min-h-[320px]"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  spellCheck={false}
                  placeholder="Füge Inhalte, Widgets oder Layout-Abschnitte hinzu..."
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">
                    Aktives Layout: <strong className="text-gray-200">{activeLayout?.label}</strong>
                  </span>
                  <button
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-2 rounded flex items-center gap-2 font-bold"
                    disabled={loading}
                  >
                    <Save size={18} /> {loading ? 'Speichert...' : 'Speichern'}
                  </button>
                </div>
              </div>

              <div className="h-full rounded-lg border border-dark-400 bg-dark-200 p-4 overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-gray-200">
                    <Eye size={16} />
                    <span className="font-semibold">Live Vorschau</span>
                  </div>
                  <span className="text-xs text-gray-400">Layout: {activeLayout?.label}</span>
                </div>
                <div className="prose prose-invert max-w-none bg-dark-300/40 border border-dark-400 rounded-lg p-4">
                  <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* HTML RENDERER */
          <div className="relative h-full">
            <div className="absolute top-4 right-4 text-[11px] px-3 py-1 rounded-full border border-dark-400 bg-dark-200 text-gray-300">
              Lesemodus
            </div>
            <div
              className="p-8 prose prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent || buildDocument(contentBody, layoutMode, layoutExtras) }}
            />
          </div>
        )}

      </div>
    </div>
  );
};
