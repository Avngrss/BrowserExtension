import { useEffect, useState } from 'react';
import { Button } from '@/src/components/Button';
import { ScreenshotViewerModal } from '@/src/components/ScreenshotViewerModal';
import type { ScreenshotEvidence } from '@/src/domain/screenshot-evidence';
import { loadScreenshotBlobUrl } from '@/src/utils/screenshot-blob-loader';

type BugTicketScreenshotProps = {
  evidence: ScreenshotEvidence[];
};

function TicketShot({ item }: { item: ScreenshotEvidence }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void loadScreenshotBlobUrl(item.storageRef).then((url) => {
      if (cancelled) {
        if (url !== null) {
          URL.revokeObjectURL(url);
        }
        return;
      }
      objectUrl = url;
      setThumbnailUrl(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.storageRef]);

  useEffect(() => {
    return () => {
      if (viewerUrl !== null) {
        URL.revokeObjectURL(viewerUrl);
      }
    };
  }, [viewerUrl]);

  if (thumbnailUrl === null) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <img
        src={thumbnailUrl}
        alt="Bug screenshot"
        className="max-h-36 w-auto rounded border border-slate-200 dark:border-slate-700"
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          void loadScreenshotBlobUrl(item.storageRef).then((url) => {
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
      {viewerUrl !== null ? (
        <ScreenshotViewerModal
          imageUrl={viewerUrl}
          alt="Bug screenshot"
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

export function BugTicketScreenshot({ evidence }: BugTicketScreenshotProps) {
  if (evidence.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {evidence.map((item) => (
        <TicketShot key={item.frameId} item={item} />
      ))}
    </div>
  );
}
