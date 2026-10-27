import {
  createIdleSessionSnapshot,
  type SessionCommand,
  type SessionSnapshot,
  type SessionTransitionResult,
} from '@/src/domain/session';
import type { SessionTargetBinding } from '@/src/domain/session-target';

type SessionClock = {
  createId: () => string;
  now: () => number;
};

export type ApplySessionCommandOptions = {
  binding?: SessionTargetBinding;
};

export function applySessionCommand(
  current: SessionSnapshot,
  command: SessionCommand,
  clock: SessionClock,
  options: ApplySessionCommandOptions = {},
): SessionTransitionResult {
  switch (command) {
    case 'start':
      return startSession(current, clock, options.binding);
    case 'pause':
      return pauseSession(current, clock);
    case 'resume':
      return resumeSession(current);
    case 'stop':
      return stopSession(current, clock);
    case 'reset':
      return resetSession(current);
  }
}

function startSession(
  current: SessionSnapshot,
  clock: SessionClock,
  binding: SessionTargetBinding | undefined,
): SessionTransitionResult {
  if (current.status !== 'idle' && current.status !== 'stopped') {
    return invalidTransition('Start is only allowed from idle or stopped.');
  }

  if (binding === undefined) {
    return invalidTransition('Session target binding is required to start.');
  }

  return {
    ok: true,
    state: {
      status: 'recording',
      id: clock.createId(),
      startedAt: clock.now(),
      pausedAt: null,
      stoppedAt: null,
      targetTabId: binding.targetTabId,
      targetUrl: binding.targetUrl,
      pageTitle: binding.pageTitle,
      pageContextUpdatedAt: binding.pageContextUpdatedAt ?? clock.now(),
    },
  };
}

function pauseSession(
  current: SessionSnapshot,
  clock: SessionClock,
): SessionTransitionResult {
  if (current.status !== 'recording') {
    return invalidTransition('Pause is only allowed while recording.');
  }

  return {
    ok: true,
    state: {
      status: 'paused',
      id: current.id,
      startedAt: current.startedAt,
      pausedAt: clock.now(),
      stoppedAt: null,
      targetTabId: current.targetTabId,
      targetUrl: current.targetUrl,
      pageTitle: current.pageTitle,
      pageContextUpdatedAt: current.pageContextUpdatedAt,
    },
  };
}

function resumeSession(current: SessionSnapshot): SessionTransitionResult {
  if (current.status !== 'paused') {
    return invalidTransition('Resume is only allowed while paused.');
  }

  return {
    ok: true,
    state: {
      status: 'recording',
      id: current.id,
      startedAt: current.startedAt,
      pausedAt: null,
      stoppedAt: null,
      targetTabId: current.targetTabId,
      targetUrl: current.targetUrl,
      pageTitle: current.pageTitle,
      pageContextUpdatedAt: current.pageContextUpdatedAt,
    },
  };
}

function stopSession(
  current: SessionSnapshot,
  clock: SessionClock,
): SessionTransitionResult {
  if (current.status !== 'recording' && current.status !== 'paused') {
    return invalidTransition('Stop is only allowed while recording or paused.');
  }

  return {
    ok: true,
    state: {
      status: 'stopped',
      id: current.id,
      startedAt: current.startedAt,
      pausedAt: current.status === 'paused' ? current.pausedAt : null,
      stoppedAt: clock.now(),
      targetTabId: current.targetTabId,
      targetUrl: current.targetUrl,
      pageTitle: current.pageTitle,
      pageContextUpdatedAt: current.pageContextUpdatedAt,
    },
  };
}

function resetSession(current: SessionSnapshot): SessionTransitionResult {
  if (current.status !== 'stopped') {
    return invalidTransition(
      'Delete is only allowed while reviewing a session.',
    );
  }

  return {
    ok: true,
    state: createIdleSessionSnapshot(),
  };
}

function invalidTransition(message: string): SessionTransitionResult {
  return {
    ok: false,
    error: {
      code: 'INVALID_TRANSITION',
      message,
    },
  };
}

export function createInitialSessionSnapshot(): SessionSnapshot {
  return createIdleSessionSnapshot();
}
