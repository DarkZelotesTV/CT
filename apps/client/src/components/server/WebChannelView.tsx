import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import ReactQuill from 'react-quill';
import type Quill from 'quill';
import 'react-quill/dist/quill.snow.css';
import { Globe, Edit, Save, X, LayoutGrid, Columns, Image, FileInput, Eye, Sparkles, Gamepad2, RefreshCw, Copy, Play } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useTopBar } from '../window/TopBarContext';
import { useChatStore } from '../../store/useChatStore';

interface WebChannelViewProps {
  channelId: number;
  channelName: string;
}

type LayoutMode = 'stack' | 'two-column' | 'grid' | 'codenames';

const LAYOUT_CLASSES: Record<LayoutMode, string> = {
  stack: 'space-y-6',
  'two-column': 'grid md:grid-cols-2 gap-6',
  grid: 'grid md:grid-cols-3 gap-6',
  codenames: 'h-full w-full'
};

const layoutClassNameSet = new Set(
  Object.values(LAYOUT_CLASSES)
    .join(' ')
    .split(' ')
    .filter(Boolean)
);

const RowsPreview = () => (
  <div className="flex flex-col gap-0.5 w-4 h-4 text-[color:var(--color-text)]">
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
  },
  {
    key: 'codenames',
    label: 'Codenames',
    description: 'Interaktives Spiel mit Lobby-Sync',
    icon: <Gamepad2 size={16} />
  }
];

const widgetSnippets: Record<string, string> = {
  media: `<div class="media-embed" data-widget="media">
  <iframe class="w-full aspect-video rounded-lg" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Embedded media" allowfullscreen></iframe>
</div>`,
  form: `<form class="bg-surface-2 p-4 rounded-lg space-y-3" data-widget="form">
  <label class="block text-sm font-semibold text-text">Kontakt</label>
  <input class="w-full bg-surface border border-border rounded px-3 py-2 text-text" placeholder="Ihre E-Mail" />
  <textarea class="w-full bg-surface border border-border rounded px-3 py-2 text-text" rows="3" placeholder="Nachricht"></textarea>
  <button type="submit" class="bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded">Senden</button>
</form>`,
  file: `<a data-widget="file" href="/files/beispiel.pdf" class="flex items-center gap-2 text-accent hover:text-accent-hover underline">
  📄 Datei herunterladen
</a>`
};

const templateOptions: { key: string; label: string; description: string; layout: LayoutMode; content: string }[] = [
  {
    key: 'welcome',
    label: 'Welcome Hero',
    description: 'Hero-Headline mit CTA und Vorteilsliste',
    layout: 'stack',
    content: `<section class="space-y-6">
  <div class="bg-surface-2 border border-border p-6 rounded-xl">
    <p class="text-accent text-sm font-semibold">Neu</p>
    <h1 class="text-3xl font-bold text-text">Willkommen in deinem Web-Channel</h1>
    <p class="text-text mt-2">Füge Widgets hinzu, teile Medien und binde Formulare ein, ohne HTML per Hand zu schreiben.</p>
    <button class="mt-4 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded">Loslegen</button>
  </div>
</section>`
  },
  {
    key: 'codenames',
    label: 'Codenames Lobby',
    description: 'Spielmodus für Gruppen',
    layout: 'codenames',
    content: 'https://codenames.game/'
  }
];

const placeholderHtml =
  '<div class="text-center text-[color:var(--color-text-muted)] mt-10"><h1>Willkommen</h1><p>Diese Seite ist noch leer.</p></div>';

// --- Codenames Stage Component ---
const CodenamesStage = ({ initialUrl, channelId, isEditing }: { initialUrl: string, channelId: number, isEditing: boolean }) => {
    const { updateChannelContent } = useChatStore();
    const [url, setUrl] = useState(initialUrl);
    const [inputUrl, setInputUrl] = useState(initialUrl);
    const [syncing, setSyncing] = useState(false);
    
    // Polling für URL Updates (damit alle Spieler im gleichen Raum landen)
    useEffect(() => {
        if (isEditing) return;
        const interval = setInterval(async () => {
            try {
                const data = await apiFetch<{ content?: string }>(`/api/channels/${channelId}/content`);
                if (data?.content) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(data.content, 'text/html');
                    const layoutNode = doc.querySelector('[data-layout="codenames"]');
                    const remoteUrl = layoutNode?.textContent?.trim() || '';
                    
                    if (remoteUrl && remoteUrl.startsWith('http') && remoteUrl !== url) {
                        setUrl(remoteUrl);
                        setInputUrl(remoteUrl);
                    }
                }
            } catch (e) { 
                // Silent fail on polling
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [channelId, url, isEditing]);

    const handleSync = async () => {
        if (!inputUrl) return;
        setSyncing(true);
        try {
            // Wir speichern die URL verpackt im korrekten Layout-Tag
            const content = `<section data-layout="codenames" class="web-channel-layout h-full w-full">${inputUrl}</section>`;
            await updateChannelContent(channelId, content);
            setUrl(inputUrl);
        } catch (error) {
            console.error(error);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-surface">
            {/* Sync Bar */}
            <div className="bg-surface-2 border-b border-border p-2 flex items-center gap-3 shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-2 text-yellow-500 px-2">
                    <Gamepad2 size={18} />
                    <span className="font-bold text-[color:var(--color-text)] text-sm hidden md:inline">Codenames</span>
                </div>
                <div className="h-6 w-px bg-border mx-1 hidden md:block"></div>
                <div className="flex-1 flex items-center gap-2 max-w-2xl">
                    <input 
                        type="text" 
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        className="flex-1 bg-surface-3 text-[color:var(--color-text)] text-sm px-3 py-1.5 rounded border border-border focus:border-accent focus:outline-none font-mono"
                        placeholder="Raum-Link hier einfügen..."
                    />
                    <button 
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {syncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        <span>Sync</span>
                    </button>
                </div>
                <div className="ml-auto text-xs text-[color:var(--color-text-muted)] hidden md:flex items-center gap-2">
                   <span className="bg-surface-3 px-2 py-1 rounded border border-border">Erstelle Raum &rarr; Kopiere Link &rarr; Sync</span>
                </div>
            </div>

            {/* Game Iframe */}
            <div className="flex-1 relative w-full h-full overflow-hidden">
                <iframe 
                    key={url} // Reload iframe on URL change
                    src={url}
                    className="w-full h-full border-none bg-white"
                    allow="autoplay; encrypted-media; microphone; camera; fullscreen; clipboard-read; clipboard-write"
                    title="Codenames Game"
                />
                 {url === 'https://codenames.game/' && (
                    <div className="absolute bottom-6 left-6 max-w-sm bg-surface-2/95 backdrop-blur border border-border p-4 rounded-xl shadow-2xl pointer-events-none">
                         <h4 className="font-bold text-[color:var(--color-text)] mb-1 flex items-center gap-2"><Play size={16} className="text-blue-500"/> Los geht's</h4>
                         <p className="text-xs text-[color:var(--color-text)]">Erstelle einen Raum im Spiel, kopiere den Link oben in die Leiste und klicke auf Sync, damit deine Freunde beitreten können.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};


export const WebChannelView = ({ channelId, channelName }: WebChannelViewProps) => {
  const { setSlots, clearSlots } = useTopBar();
  const isDesktop = typeof window !== 'undefined' && !!window.ct?.windowControls;

  const [htmlContent, setHtmlContent] = useState('');
  const [contentBody, setContentBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('stack');
  const [layoutExtras, setLayoutExtras] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const editorRef = useRef<ReactQuill | null>(null);

  const sanitizerConfig: DOMPurifyConfig = useMemo(
    () => ({
      ADD_ATTR: ['data-layout', 'data-widget', 'style'],
      ADD_TAGS: ['section']
    }),
    []
  );

  const sanitizeContent = (value: string) => DOMPurify.sanitize(value, sanitizerConfig);

  const buildDocument = (body: string, layout: LayoutMode, extras = '') => {
    // Special Handling für Codenames Mode: Wir wrappen die URL einfach in das Layout-Tag
    if (layout === 'codenames') {
        return `<section data-layout="codenames" class="web-channel-layout ${LAYOUT_CLASSES.codenames}">${body}</section>`;
    }

    const layoutClassNames = ['web-channel-layout', LAYOUT_CLASSES[layout], extras]
      .filter(Boolean)
      .join(' ');
    const sanitizedBody = sanitizeContent(body || '');
    const safeBody = sanitizedBody?.trim() ? sanitizedBody : placeholderHtml;
    const layoutWrapperPattern = /<[^>]*data-layout=/;

    if (layoutWrapperPattern.test(sanitizedBody)) {
      return sanitizeContent(sanitizedBody);
    }

    return sanitizeContent(`<section data-layout="${layout}" class="${layoutClassNames}">${safeBody}</section>`);
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
        // Für Codenames ist der Inhalt nur der Text (URL)
        const innerContent = detectedLayout === 'codenames' 
            ? layoutNode.textContent || '' 
            : layoutNode.innerHTML?.trim() || '';

        const extraClassNames = Array.from(layoutNode.classList)
          .filter((className) => className !== 'web-channel-layout' && !layoutClassNameSet.has(className))
          .join(' ');

        return {
          layout: (['stack', 'two-column', 'grid', 'codenames'].includes(detectedLayout) ? detectedLayout : 'stack') as LayoutMode,
          body: detectedLayout === 'codenames' ? innerContent : sanitizeContent(innerContent),
          extras: extraClassNames
        };
      }

      return { layout: 'stack' as LayoutMode, body: sanitizeContent(content), extras: '' };
    } catch (err) {
      console.error('Parsing error', err);
      return { layout: 'stack' as LayoutMode, body: sanitizeContent(content || ''), extras: '' };
    }
  };

  const previewContent = useMemo(
    () => buildDocument(editValue, layoutMode, layoutExtras),
    [editValue, layoutMode, layoutExtras]
  );

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ['link', 'blockquote', 'code-block'],
        ['clean']
      ],
      history: { delay: 500, maxStack: 100, userOnly: true },
      clipboard: { matchVisual: false }
    }),
    []
  );

  const quillFormats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'color', 'background', 'align', 'link', 'blockquote', 'code-block'
  ];

  const handleTemplateApply = () => {
    const template = templateOptions.find((option) => option.key === selectedTemplate);
    if (!template) return;
    setLayoutMode(template.layout);
    setLayoutExtras('');
    // Bei Codenames setzen wir die URL direkt als Value
    setEditValue(template.layout === 'codenames' ? template.content : sanitizeContent(template.content));
    setStatusMessage(`Vorlage "${template.label}" geladen.`);
  };

  const handleWidgetDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      // Drop disabled for Codenames mode
      if (layoutMode === 'codenames') return;
      
      const htmlSnippet = event.dataTransfer?.getData('text/html') || event.dataTransfer?.getData('text/plain');
      if (!htmlSnippet) return;

      const editor = editorRef.current?.getEditor?.() as Quill | undefined;
      if (!editor) return;

      const selection = editor.getSelection(true);
      const sanitizedSnippet = sanitizeContent(htmlSnippet);
      const insertIndex = selection?.index ?? editor.getLength();
      editor.clipboard.dangerouslyPasteHTML(insertIndex, sanitizedSnippet);
      editor.setSelection(insertIndex + sanitizedSnippet.length, 0);
      setStatusMessage('Widget eingefügt.');
    },
    [sanitizeContent, layoutMode]
  );

  const handleWidgetDragStart = (event: React.DragEvent<HTMLDivElement>, snippet?: string) => {
    if (!snippet) return;
    event.dataTransfer?.setData('text/html', snippet);
    event.dataTransfer?.setData('text/plain', snippet);
    setStatusMessage('Ziehe das Widget in den Editor, um es einzufügen.');
  };

  const validateContent = (html: string, rawBody: string) => {
    if (layoutMode === 'codenames') return null; // Simple URL validation happens elsewhere or trusted

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const parserError = doc.querySelector('parsererror');

    const sanitizedBody = sanitizeContent(rawBody);
    const strippedText = sanitizedBody.replace(/<[^>]*>/g, '').trim();
    const hasInteractiveElements = /<(iframe|video|audio|form|input|textarea|select|button|img)[^>]*>/i.test(sanitizedBody);
    const hasLinks = /<a\s[^>]*href=/i.test(sanitizedBody);

    if (/(<script|on\w+=|javascript:)/i.test(rawBody)) {
      return 'Unsichere Skripte und Event-Handler sind nicht erlaubt.';
    }

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
        setContentBody(body); // raw body (URL for codenames, HTML for others)
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
    const sanitizedSnippet = sanitizeContent(snippet);
    setEditValue((current) => sanitizeContent(`${current?.trim() ? `${current}\n\n` : ''}${sanitizedSnippet}`));
    setStatusMessage('Widget eingefügt.');
  };

  const layoutBadge = (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isEditing ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-surface-3 text-[color:var(--color-text)] border border-border'}`}>
      {isEditing ? 'Edit Mode' : (layoutMode === 'codenames' ? 'Game Mode' : 'Read-only')}
    </span>
  );

  const activeLayout = layoutOptions.find((option) => option.key === layoutMode);

  const desktopRightControls = useMemo(
    () => (
      <div className="no-drag flex items-center gap-2">
        {layoutBadge}
        {statusMessage && !isEditing && (
          <span className="text-green-300 text-xs bg-green-900/50 px-3 py-1 rounded-full border border-green-700">
            {statusMessage}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            if (!isEditing) setEditValue(contentBody || '<h1>Willkommen!</h1><p>Bearbeite mich...</p>');
            setIsEditing(!isEditing);
            setStatusMessage(null);
            setError(null);
          }}
          className={`flex items-center gap-2 text-xs uppercase font-bold px-3 py-2 rounded border transition ${
            isEditing
              ? 'text-red-200 border-red-400/40 hover:border-red-300'
              : 'text-[color:var(--color-text)] border-border hover:border-border'
          }`}
        >
          {isEditing ? <X size={16} /> : <Edit size={16} />}
          {isEditing ? 'Abbrechen' : 'Seite bearbeiten'}
        </button>
      </div>
    ),
    [layoutBadge, statusMessage, isEditing, contentBody],
  );

  useEffect(() => {
    if (!isDesktop) return;
    setSlots({ right: desktopRightControls });
    return () => clearSlots();
  }, [isDesktop, setSlots, clearSlots, desktopRightControls]);


  // --- Render Codenames View if active and NOT editing ---
  if (layoutMode === 'codenames' && !isEditing) {
      return (
          <div className="flex-1 flex flex-col bg-surface relative z-0 h-full overflow-hidden">
               {/* Mobile Header if not desktop */}
               {!isDesktop && (
                <div className="h-12 border-b border-border flex items-center px-4 shadow-sm bg-surface flex-shrink-0 justify-between">
                    <div className="flex items-center gap-3">
                    <Globe className="text-[color:var(--color-text-muted)]" size={20} />
                    <span className="font-bold text-text mr-2">{channelName}</span>
                    {layoutBadge}
                    </div>
                    {/* Reuse the Desktop Right Controls logic for mobile button */}
                    <div className="flex items-center gap-3">
                         <button
                            onClick={() => {
                            if (!isEditing) setEditValue(contentBody || 'https://codenames.game/');
                            setIsEditing(!isEditing);
                            }}
                            className="flex items-center gap-2 text-xs uppercase font-bold px-3 py-2 rounded border border-border text-[color:var(--color-text)]"
                        >
                            <Edit size={16} /> Seite bearbeiten
                        </button>
                    </div>
                </div>
               )}
               
               <CodenamesStage initialUrl={contentBody || 'https://codenames.game/'} channelId={channelId} isEditing={isEditing} />
          </div>
      );
  }

  // --- Render Default Editor/HTML View ---
  return (
    <div className="flex-1 flex flex-col bg-surface relative z-0 h-full overflow-hidden">

      {!isDesktop && (
      <div className="h-12 border-b border-border flex items-center px-4 shadow-sm bg-surface flex-shrink-0 justify-between">
        <div className="flex items-center gap-3">
          <Globe className="text-[color:var(--color-text-muted)]" size={20} />
          <span className="font-bold text-text mr-2">{channelName}</span>
          {layoutBadge}
        </div>
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
                : 'text-[color:var(--color-text)] border-border hover:border-border'
            }`}
          >
            {isEditing ? <X size={16} /> : <Edit size={16} />}
            {isEditing ? 'Abbrechen' : 'Seite bearbeiten'}
          </button>
        </div>
      </div>
      )}


      {error && (
        <div className="bg-red-900/50 text-red-100 text-sm px-4 py-2 border-b border-red-800">
          {error}
        </div>
      )}

      {statusMessage && isEditing && !error && (
        <div className="bg-surface-3/60 text-text text-sm px-4 py-2 border-b border-border flex items-center gap-2">
          <Eye size={14} /> {statusMessage}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">

        {isEditing ? (
          <div className="flex flex-col h-full p-4 gap-4">
            <div className="bg-surface-2 border border-border rounded-lg p-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)] font-semibold">Layout & Modus</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {layoutOptions.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => setLayoutMode(option.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition ${
                            layoutMode === option.key
                              ? 'bg-accent/20 border-accent text-accent'
                              : 'bg-surface-3 border-border text-[color:var(--color-text)] hover:border-border'
                          }`}
                        >
                          {option.icon}
                          <div className="text-left">
                            <div className="font-semibold leading-4">{option.label}</div>
                            <div className="text-[11px] text-[color:var(--color-text-muted)] leading-4">{option.description}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 min-w-[260px]">
                    <p className="text-xs uppercase tracking-wide text-[color:var(--color-text-muted)] font-semibold">Vorlagen & Widgets</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={selectedTemplate}
                        onChange={(event) => setSelectedTemplate(event.target.value)}
                        className="bg-surface-3 border border-border text-[color:var(--color-text)] text-sm rounded px-3 py-2 min-w-[180px]"
                      >
                        <option value="">Vorlage wählen</option>
                        {templateOptions.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleTemplateApply}
                        disabled={!selectedTemplate}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-accent/50 text-sm text-accent bg-accent/20 disabled:opacity-50"
                      >
                        <Sparkles size={16} /> Vorlage laden
                      </button>
                    </div>
                    {/* Widgets only if not codenames mode */}
                    {layoutMode !== 'codenames' && (
                        <div className="grid sm:grid-cols-3 gap-2 w-full">
                        {/* Widgets ... (wie zuvor) */}
                        <div
                            draggable
                            onClick={() => widgetSnippets.media && appendSnippet(widgetSnippets.media)}
                            onDragStart={(event) => handleWidgetDragStart(event, widgetSnippets.media)}
                            className="border border-border rounded-lg p-3 bg-surface-3 text-left cursor-grab hover:border-border transition"
                        >
                            <div className="flex items-center gap-2 font-semibold text-[color:var(--color-text)]">
                            <Image size={16} /> Media
                            </div>
                        </div>
                         {/* ... weitere Widgets verkürzt ... */}
                        </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="flex flex-col h-full gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm text-[color:var(--color-text)] font-semibold">
                        {layoutMode === 'codenames' ? 'Start-URL (Codenames)' : 'Visueller Editor'}
                    </label>
                  </div>
                  
                  {layoutMode === 'codenames' ? (
                      <div className="flex-1 bg-surface-3 border border-border rounded-lg p-4 font-mono text-[color:var(--color-text)] flex flex-col gap-2">
                          <label className="text-xs text-[color:var(--color-text-muted)] uppercase">Standard URL</label>
                          <input 
                            type="text" 
                            value={editValue} 
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-surface-2 border border-border p-2 rounded text-text"
                          />
                          <p className="text-sm text-[color:var(--color-text-muted)] mt-2">
                              Im Codenames-Modus wird dieser Link als Standard geladen. Spieler können zur Laufzeit Räume synchronisieren.
                          </p>
                      </div>
                  ) : (
                    <div
                        className="flex-1 bg-surface-3 border border-border rounded-lg overflow-hidden"
                        onDrop={handleWidgetDrop}
                        onDragOver={(event) => event.preventDefault()}
                    >
                        <ReactQuill
                        ref={(instance) => {
                            if (instance) editorRef.current = instance;
                        }}
                        theme="snow"
                        value={editValue}
                        onChange={(value) => {
                            setEditValue(sanitizeContent(value));
                            setStatusMessage(null);
                            setError(null);
                        }}
                        modules={quillModules}
                        formats={quillFormats}
                        placeholder="Inhalt hier..."
                        className="h-full flex flex-col text-[color:var(--color-text)] [&_.ql-editor]:min-h-[280px] [&_.ql-editor]:bg-surface-3 [&_.ql-editor]:text-[color:var(--color-text)] [&_.ql-toolbar]:bg-surface-2 [&_.ql-toolbar]:border-border [&_.ql-container]:border-none"
                        />
                    </div>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-[color:var(--color-text-muted)]">
                      Aktives Layout: <strong className="text-[color:var(--color-text)]">{activeLayout?.label}</strong>
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

                <div className="h-full rounded-lg border border-border bg-surface-2 p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-[color:var(--color-text)]">
                      <Eye size={16} />
                      <span className="font-semibold">Live Vorschau</span>
                    </div>
                    <span className="text-xs text-[color:var(--color-text-muted)]">Layout: {activeLayout?.label}</span>
                  </div>
                  {layoutMode === 'codenames' ? (
                      <div className="h-[400px] border border-border rounded overflow-hidden relative">
                          <div className="absolute inset-0 flex items-center justify-center bg-surface-3 text-[color:var(--color-text-muted)] flex-col gap-2">
                             <Gamepad2 size={48} className="opacity-50"/>
                             <p>Vorschau der Spiel-Ansicht</p>
                          </div>
                      </div>
                  ) : (
                    <div className="prose prose-invert max-w-none bg-surface-3/40 border border-border rounded-lg p-4">
                        <div dangerouslySetInnerHTML={{ __html: previewContent }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            ) : (
              /* HTML RENDERER (Fallback if logic above misses) */
              <div className="relative h-full">
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
