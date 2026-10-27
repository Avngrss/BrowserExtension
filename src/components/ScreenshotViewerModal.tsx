import { useEffect } from 'react';
import { Button } from '@/src/components/Button';

type ScreenshotViewerModalProps = {
  imageUrl: string;
  alt: string;
  onClose: () => void;
};

export function ScreenshotViewerModal({
  imageUrl,
  alt,
  onClose,
}: ScreenshotViewerModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Screenshot preview"
        className="relative max-h-full max-w-full rounded-md bg-white p-2 dark:bg-slate-900"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <img
          src={imageUrl}
          alt={alt}
          className="mt-2 max-h-[80vh] max-w-[min(100vw-2rem,960px)] object-contain"
        />
      </div>
    </div>
  );
}
