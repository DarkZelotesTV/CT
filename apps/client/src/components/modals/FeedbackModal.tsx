import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModalLayout } from './ModalLayout';
import { Icon } from '../ui';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
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
  const labelClassName = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]';
  const helperClassName = 'text-xs text-[color:var(--color-text-muted)]';

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

      // With `exactOptionalPropertyTypes`, omit optional properties instead of passing `undefined`.
      await sendFeedback({
        category,
        message: message.trim(),
        ...(screenshotData ? { screenshot: screenshotData } : {}),
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
          <div className="text-left text-xs text-[color:var(--color-text-muted)]" aria-live="polite">
            {success && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Icon icon={CheckCircle2} size="md" tone="default" className="text-inherit" /> {t('feedbackModal.success')}
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-red-400">
                <Icon icon={AlertCircle} size="md" tone="default" className="text-inherit" /> {t('feedbackModal.error')}
              </span>
            )}
          </div>
          <Button
            type="submit"
            form="feedback-form"
            variant="primary"
            size="sm"
            disabled={submitting || message.trim().length === 0}
          >
            {submitting ? (
              <Icon icon={Loader2} size="md" tone="default" className="text-inherit animate-spin" />
            ) : (
              <Icon icon={Send} size="md" tone="default" className="text-inherit" />
            )}
            {t('feedbackModal.submit')}
          </Button>
        </div>
      }
    >
      <form id="feedback-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="feedback-category" className={labelClassName}>
            {t('feedbackModal.categoryLabel')}
          </label>
          <Select
            id="feedback-category"
            selectSize="md"
            className="bg-[color:var(--color-surface)]/60"
            value={category}
            onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
          >
            {categories.map((option) => (
              <option key={option} value={option}>
                {t(`feedbackModal.categories.${option}` as const)}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <label htmlFor="feedback-message" className={labelClassName}>
            {t('feedbackModal.messageLabel')}
          </label>
          <textarea
            id="feedback-message"
            ref={textareaRef}
            className="w-full min-h-[140px] rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 px-3 py-2 text-sm text-[color:var(--color-text)] focus-visible:border-[color:var(--color-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            placeholder={t('feedbackModal.messagePlaceholder')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <p className={helperClassName}>{t('feedbackModal.messageHelp')}</p>
        </div>

        <div className="space-y-2">
          <label className={labelClassName} htmlFor="feedback-screenshot">
            {t('feedbackModal.screenshotLabel')}
          </label>
          <div className="flex items-center gap-2">
            <label
              htmlFor="feedback-screenshot"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--radius-3)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]/60 text-sm text-[color:var(--color-text)] cursor-pointer hover:border-[color:var(--color-border-strong)] focus-within:border-[color:var(--color-focus)] focus-within:ring-2 focus-within:ring-[color:var(--color-focus)] focus-within:ring-offset-2 focus-within:ring-offset-background"
            >
              <Icon icon={ImagePlus} size="md" tone="default" className="text-inherit" />
              <span className="truncate">{screenshotLabel}</span>
              <Input
                id="feedback-screenshot"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => setScreenshotFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {screenshotFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs underline"
                onClick={() => setScreenshotFile(null)}
              >
                {t('feedbackModal.removeScreenshot')}
              </Button>
            )}
          </div>
          <p className={helperClassName}>{t('feedbackModal.screenshotHelp')}</p>
        </div>
      </form>
    </ModalLayout>
  );
};
