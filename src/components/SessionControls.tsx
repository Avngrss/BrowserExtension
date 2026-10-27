import { Button } from '@/src/components/Button';
import type { SessionStatus } from '@/src/domain/session';

type SessionControlsProps = {
  status: SessionStatus;
  loading: boolean;
  processing: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
};

export function SessionControls({
  status,
  loading,
  processing,
  onStart,
  onPause,
  onResume,
  onStop,
}: SessionControlsProps) {
  const disabled = loading || processing;

  if (status === 'idle' || status === 'stopped') {
    return (
      <Button disabled={disabled} onClick={onStart}>
        Start capture
      </Button>
    );
  }

  if (status === 'recording') {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <Button disabled={disabled} variant="secondary" onClick={onPause}>
          Pause
        </Button>
        <Button disabled={disabled} onClick={onStop}>
          Stop and review
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button disabled={disabled} onClick={onResume}>
        Resume
      </Button>
      <Button disabled={disabled} variant="secondary" onClick={onStop}>
        Stop and review
      </Button>
    </div>
  );
}
