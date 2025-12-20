import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import ReactQuill from 'react-quill';
import type Quill from 'quill';
import 'react-quill/dist/quill.snow.css';
import { Globe, Edit, Save, X, LayoutGrid, Columns, Image, FileInput, Eye, Sparkles } from 'lucide-react';
import { apiFetch } from '../../api/http';
import { useTopBar } from '../window/TopBarContext';

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

const templateOptions: { key: string; label: string; description: string; layout: LayoutMode; content: string }[] = [
  {
    key: 'welcome',
    label: 'Welcome Hero',
    description: 'Hero-Headline mit CTA und Vorteilsliste',
    layout: 'stack',
    content: `<section class="space-y-6">
  <div class="bg-dark-200 border border-dark-400 p-6 rounded-xl">
    <p class="text-blue-300 text-sm font-semibold">Neu</p>
    <h1 class="text-3xl font-bold">Willkommen in deinem Web-Channel</h1>
    <p class="text-gray-300 mt-2">Füge Widgets hinzu, teile Medien und binde Formulare ein, ohne HTML per Hand zu schreiben.</p>
    <button class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Loslegen</button>
  </div>
  <div class="grid md:grid-cols-3 gap-4">
    <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg">
      <p class="text-sm text-blue-300 font-semibold">Widgets</p>
      <p class="text-gray-300">Ziehe Karten oder Formulare aus der Liste rechts direkt in den Editor.</p>
    </div>
    <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg">
      <p class="text-sm text-blue-300 font-semibold">Layout</p>
      <p class="text-gray-300">Wechsle zwischen Spalten-, Stack- oder Grid-Layouts.</p>
    </div>
    <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg">
      <p class="text-sm text-blue-300 font-semibold">Vorschau</p>
      <p class="text-gray-300">Änderungen werden sofort in der Live-Vorschau angezeigt.</p>
    </div>
  </div>
</section>`
  },
  {
    key: 'event',
    label: 'Event-Teaser',
    description: 'Veranstaltung mit Zeitplan und CTA',
    layout: 'two-column',
    content: `<div class="space-y-4">
  <div class="bg-gradient-to-r from-blue-700/60 to-purple-700/60 p-5 rounded-xl border border-blue-500/30">
    <p class="text-xs uppercase tracking-wide text-blue-200">Livestream</p>
    <h2 class="text-2xl font-bold">Community Meetup</h2>
    <p class="text-gray-100">Freitag, 19:00 Uhr – mit Q&A und Demos.</p>
  </div>
  <div class="grid md:grid-cols-2 gap-4">
    <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg space-y-2">
      <p class="text-sm font-semibold text-gray-100">Agenda</p>
      <ul class="list-disc list-inside text-gray-300 space-y-1">
        <li>Updates & Produkt-News</li>
        <li>Show & Tell der Community</li>
        <li>Live Q&A mit dem Team</li>
      </ul>
    </div>
    <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg space-y-3">
      <p class="text-sm font-semibold text-gray-100">Jetzt teilnehmen</p>
      <div data-widget="media" class="rounded-lg overflow-hidden border border-dark-400">
        <iframe class="w-full aspect-video" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Livestream"></iframe>
      </div>
      <a class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" href="#">Kalender speichern</a>
    </div>
  </div>
</div>`
  },
  {
    key: 'downloads',
    label: 'Download-Sammlung',
    description: 'Kartenraster mit Dateien und Formular',
    layout: 'grid',
    content: `<div class="grid md:grid-cols-3 gap-4">
  <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg space-y-3" data-widget="file">
    <h3 class="font-semibold text-gray-100">Whitepaper</h3>
    <p class="text-gray-300 text-sm">Alle Fakten in einem Dokument.</p>
    <a class="text-blue-300 hover:text-blue-200 underline" href="/files/whitepaper.pdf">PDF herunterladen</a>
  </div>
  <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg space-y-3" data-widget="file">
    <h3 class="font-semibold text-gray-100">Produkt-Assets</h3>
    <p class="text-gray-300 text-sm">Screenshots & Logos im Paket.</p>
    <a class="text-blue-300 hover:text-blue-200 underline" href="/files/assets.zip">ZIP herunterladen</a>
  </div>
  <div class="bg-dark-200 border border-dark-400 p-4 rounded-lg space-y-3" data-widget="form">
    <h3 class="font-semibold text-gray-100">Kontakt</h3>
    <p class="text-gray-300 text-sm">Fragen? Schreib uns.</p>
    <form class="space-y-2">
      <input class="w-full bg-dark-100 border border-dark-400 rounded px-3 py-2" placeholder="E-Mail" />
      <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded w-full">Absenden</button>
    </form>
  </div>
</div>`
  }
];

const placeholderHtml =
  '<div class="text-center text-gray-500 mt-10"><h1>Willkommen</h1><p>Diese Seite ist noch leer.</p></div>';

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
        const extraClassNames = Array.from(layoutNode.classList)
          .filter((className) => className !== 'web-channel-layout' && !layoutClassNameSet.has(className))
          .join(' ');

        return {
          layout: (['stack', 'two-column', 'grid'].includes(detectedLayout) ? detectedLayout : 'stack') as LayoutMode,
          body: sanitizeContent(layoutNode.innerHTML?.trim() || ''),
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
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'color',
    'background',
    'align',
    'link',
    'blockquote',
    'code-block'
  ];

  const handleTemplateApply = () => {
    const template = templateOptions.find((option) => option.key === selectedTemplate);
    if (!template) return;
    setLayoutMode(template.layout);
    setLayoutExtras('');
    setEditValue(sanitizeContent(template.content));
    setStatusMessage(`Vorlage "${template.label}" geladen.`);
  };

  const handleWidgetDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
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
    [sanitizeContent]
  );

  const handleWidgetDragStart = (event: React.DragEvent<HTMLDivElement>, snippet?: string) => {
    if (!snippet) return;
    event.dataTransfer?.setData('text/html', snippet);
    event.dataTransfer?.setData('text/plain', snippet);
    setStatusMessage('Ziehe das Widget in den Editor, um es einzufügen.');
  };

  const validateContent = (html: string, rawBody: string) => {
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
        setContentBody(sanitizeContent(body));
        setHtmlContent(wrappedContent);
        setEditValue(sanitizeContent(body));
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
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isEditing ? 'bg-blue-500/20 text-blue-200 border border-blue-500/50' : 'bg-dark-300 text-gray-300 border border-dark-400'}`}>
      {isEditing ? 'Edit Mode' : 'Read-only'}
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
              : 'text-gray-200 border-dark-400 hover:border-dark-200'
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


  return (
    <div className="flex-1 flex flex-col bg-dark-100 relative z-0 h-full overflow-hidden">

      {!isDesktop && (
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
      )}


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
                  <div className="flex flex-col gap-3 min-w-[260px]">
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Vorlagen & Widgets</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={selectedTemplate}
                        onChange={(event) => setSelectedTemplate(event.target.value)}
                        className="bg-dark-300 border border-dark-400 text-gray-200 text-sm rounded px-3 py-2 min-w-[180px]"
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
                        className="flex items-center gap-2 px-3 py-2 rounded border border-blue-500/50 text-sm text-blue-100 bg-blue-600/20 disabled:opacity-50"
                      >
                        <Sparkles size={16} /> Vorlage laden
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2 w-full">
                      <div
                        draggable
                        onClick={() => widgetSnippets.media && appendSnippet(widgetSnippets.media)}
                        onDragStart={(event) => handleWidgetDragStart(event, widgetSnippets.media)}
                        className="border border-dark-400 rounded-lg p-3 bg-dark-300 text-left cursor-grab hover:border-dark-200 transition"
                      >
                        <div className="flex items-center gap-2 font-semibold text-gray-100">
                          <Image size={16} /> Media-Embed
                        </div>
                        <p className="text-[11px] text-gray-400">Ziehen oder klicken, um ein Video einzufügen.</p>
                      </div>
                      <div
                        draggable
                        onClick={() => widgetSnippets.form && appendSnippet(widgetSnippets.form)}
                        onDragStart={(event) => handleWidgetDragStart(event, widgetSnippets.form)}
                        className="border border-dark-400 rounded-lg p-3 bg-dark-300 text-left cursor-grab hover:border-dark-200 transition"
                      >
                        <div className="flex items-center gap-2 font-semibold text-gray-100">
                          <Edit size={16} /> Formular
                        </div>
                        <p className="text-[11px] text-gray-400">Kontaktfeld oder Feedback einbinden.</p>
                      </div>
                      <div
                        draggable
                        onClick={() => widgetSnippets.file && appendSnippet(widgetSnippets.file)}
                        onDragStart={(event) => handleWidgetDragStart(event, widgetSnippets.file)}
                        className="border border-dark-400 rounded-lg p-3 bg-dark-300 text-left cursor-grab hover:border-dark-200 transition"
                      >
                        <div className="flex items-center gap-2 font-semibold text-gray-100">
                          <FileInput size={16} /> Datei-Link
                        </div>
                        <p className="text-[11px] text-gray-400">Downloads oder Assets verlinken.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <Eye size={14} /> Layout-Vorschau zeigt Raster- oder Abschnittsstruktur live an.
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="flex flex-col h-full gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm text-gray-300 font-semibold">Visueller Editor</label>
                    <span className="text-[11px] text-gray-400">Drag & Drop für Widgets unterstützt.</span>
                  </div>
                  <div
                    className="flex-1 bg-dark-300 border border-dark-400 rounded-lg overflow-hidden"
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
                      placeholder="Schreibe Text, füge Links hinzu oder lasse Widgets fallen..."
                      className="h-full flex flex-col text-gray-100 [&_.ql-editor]:min-h-[280px] [&_.ql-editor]:bg-dark-300 [&_.ql-editor]:text-gray-100 [&_.ql-toolbar]:bg-dark-200 [&_.ql-toolbar]:border-dark-400 [&_.ql-container]:border-none"
                    />
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2">
                    <Eye size={14} /> Änderungen werden automatisch in der Vorschau gespiegelt.
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
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
