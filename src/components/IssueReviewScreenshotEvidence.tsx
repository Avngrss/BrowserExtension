import { useEffect, useState } from 'react';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import { screenshotStatusLabel } from '@/src/domain/screenshot-evidence';
import type { IssueReviewCategory } from '@/src/domain/issue-disposition';
import { Button } from '@/src/components/Button';
import { ScreenshotViewerModal } from '@/src/components/ScreenshotViewerModal';
import { loadScreenshotBlobUrl } from '@/src/utils/screenshot-blob-loader';

type IssueReviewScreenshotEvidenceProps = {
  category: IssueReviewCategory;
  issueId: string;
  disposition: string;
  evidence: ScreenshotEvidence[];
  onRemove: (screenshotId: string) => Promise<boolean>;
};

export function IssueReviewScreenshotEvidence({
  category,
  issueId,
  disposition,
  evidence,
  onRemove,
}: IssueReviewScreenshotEvidenceProps) {
  const record = evidence.find(
    (item) => item.issueCategory === category && item.issueId === issueId,
  );

  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(false);

  useEffect(() => {
    if (record?.status !== 'captured') {
      setThumbnailUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoadingThumb(true);
    void loadScreenshotBlobUrl(record.storageRef)
      .then((url) => {
        if (cancelled) {
          if (url !== null) {
            URL.revokeObjectURL(url);
          }
          return;
        }
        objectUrl = url;
        setThumbnailUrl(url);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingThumb(false);
        }
      });
    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [record?.status, record?.storageRef]);

  useEffect(() => {
    return () => {
      if (viewerUrl !== null) {
        URL.revokeObjectURL(viewerUrl);
      }
    };
  }, [viewerUrl]);

  if (record === undefined) {
    return null;
  }

  const statusLabel = screenshotStatusLabel({
    status: record.status,
    failureReason: record.failureReason,
  });

  return (
    <div className="mt-2 flex min-w-0 flex-col gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
      {disposition === 'excluded' ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Excluded from future output
        </p>
      ) : null}

      {record.linkedIssueCount > 1 && record.status === 'captured' ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Shared evidence for {record.linkedIssueCount} related issues
        </p>
      ) : null}

      {statusLabel.length > 0 &&
      (record.status !== 'captured' || loadingThumb) ? (
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {record.status === 'captured' && loadingThumb
            ? 'Loading screenshot…'
            : statusLabel}
        </p>
      ) : null}

      {record.status === 'captured' && thumbnailUrl !== null ? (
        <div className="flex min-w-0 flex-col gap-2">
          <img
            src={thumbnailUrl}
            alt="Issue screenshot thumbnail"
            className="max-h-24 w-auto rounded border border-slate-200 dark:border-slate-700"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadScreenshotBlobUrl(record.storageRef).then((url) => {
                  if (url !== null) {
                    setViewerUrl((previous) => {
                      if (previous !== null) {
                        URL.revokeObjectURL(previous);
                      }
                      return url;
                    });
                  }
                });
              }}
            >
              View screenshot
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                void onRemove(record.id);
              }}
            >
              Remove screenshot
            </Button>
          </div>
        </div>
      ) : null}

      {viewerUrl !== null ? (
        <ScreenshotViewerModal
          imageUrl={viewerUrl}
          alt="Issue screenshot"
          onClose={() => {
            setViewerUrl((previous) => {
              if (previous !== null) {
                URL.revokeObjectURL(previous);
              }
              return null;
            });
          }}
        />
      ) : null}
    </div>
  );
}
