import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalLayout } from './ModalLayout';
import { FeedbackCategory, sendFeedback } from '../../services/feedback';

interface FeedbackModalProps {
  onClose: () => void;
}

const categories: FeedbackCategory[] = ['bug', 'idea', 'other'];

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const FeedbackModal = ({ onClose }: FeedbackModalProps) => {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const screenshotLabel = useMemo(
    () => screenshotFile?.name ?? t('feedbackModal.screenshotPlaceholder'),
    [screenshotFile?.name, t]
  );

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const screenshotData = screenshotFile ? await readFileAsDataUrl(screenshotFile) : undefined;

      await sendFeedback({
        category,
        message: message.trim(),
        screenshot: screenshotData,
      });

      setSuccess(true);
      setMessage('');
      setScreenshotFile(null);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : t('feedbackModal.errorFallback')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalLayout
      title={t('feedbackModal.title')}
      description={t('feedbackModal.description')}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-left text-xs text-gray-400" aria-live="polite">
            {success && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={16} /> {t('feedbackModal.success')}
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertCircle size={16} /> {t('feedbackModal.error')}
              </span>
            )}
          </div>
          <button
            type="submit"
            form="feedback-form"
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={submitting || message.trim().length === 0}
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {t('feedbackModal.submit')}
          </button>
        </div>
      }
    >
      <form id="feedback-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="feedback-category" className="text-sm font-semibold text-white">
            {t('feedbackModal.categoryLabel')}
          </label>
          <select
            id="feedback-category"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
            value={category}
            onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
          >
            {categories.map((option) => (
              <option key={option} value={option}>
                {t(`feedbackModal.categories.${option}` as const)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="feedback-message" className="text-sm font-semibold text-white">
            {t('feedbackModal.messageLabel')}
          </label>
          <textarea
            id="feedback-message"
            ref={textareaRef}
            className="w-full min-h-[140px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
            placeholder={t('feedbackModal.messagePlaceholder')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <p className="text-xs text-gray-400">{t('feedbackModal.messageHelp')}</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-white" htmlFor="feedback-screenshot">
            {t('feedbackModal.screenshotLabel')}
          </label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="feedback-screenshot"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-black/30 text-sm text-gray-100 cursor-pointer hover:border-cyan-500 focus-within:border-cyan-500"
            >
              <ImagePlus size={16} />
              <span className="truncate">{screenshotLabel}</span>
              <input
                id="feedback-screenshot"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => setScreenshotFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {screenshotFile && (
              <button
                type="button"
                className="text-xs text-gray-400 underline hover:text-white"
                onClick={() => setScreenshotFile(null)}
              >
                {t('feedbackModal.removeScreenshot')}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">{t('feedbackModal.screenshotHelp')}</p>
        </div>
      </form>
    </ModalLayout>
  );
};
