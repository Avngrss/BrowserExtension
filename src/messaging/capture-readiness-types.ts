export const REPORT_COLLECTOR_READINESS = 'REPORT_COLLECTOR_READINESS' as const;
export const CAPTURE_READINESS_UPDATED = 'CAPTURE_READINESS_UPDATED' as const;
export const GET_CAPTURE_READINESS = 'GET_CAPTURE_READINESS' as const;
export const REBROADCAST_SESSION_TO_TAB = 'REBROADCAST_SESSION_TO_TAB' as const;

export type CollectorReadinessFlags = {
  actions: boolean;
  ui: boolean;
  console: boolean;
  network: boolean;
};

export type ReportCollectorReadinessMessage = {
  type: typeof REPORT_COLLECTOR_READINESS;
  sessionId: string;
  revision: number;
  tabId: number;
  collectors: CollectorReadinessFlags;
};

export type CaptureReadinessSnapshot = {
  sessionId: string;
  revision: number;
  tabId: number;
  collectors: CollectorReadinessFlags;
  reconnecting: boolean;
  updatedAt: number;
};

export type CaptureReadinessUpdatedMessage = {
  type: typeof CAPTURE_READINESS_UPDATED;
  readiness: CaptureReadinessSnapshot | null;
};

export type GetCaptureReadinessMessage = {
  type: typeof GET_CAPTURE_READINESS;
};

export type RebroadcastSessionToTabMessage = {
  type: typeof REBROADCAST_SESSION_TO_TAB;
};
