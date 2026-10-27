import type { SessionBackend } from '@/src/messaging/session-backend';
import type { SessionResponse } from '@/src/messaging/session-types';
import {
  REPORT_PAGE_CONTEXT,
  type ReportPageContextMessage,
} from '@/src/messaging/page-context-types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isReportPageContextMessage(
  message: unknown,
): message is ReportPageContextMessage {
  return (
    isRecord(message) &&
    message.type === REPORT_PAGE_CONTEXT &&
    typeof message.url === 'string' &&
    typeof message.updatedAt === 'number' &&
    Number.isFinite(message.updatedAt)
  );
}

type PageContextBackend = SessionBackend & {
  updatePageContext?(
    input: Omit<ReportPageContextMessage, 'type'>,
    senderTabId: number | undefined,
  ): Promise<SessionResponse>;
};

export async function handleReportPageContextMessage(
  message: ReportPageContextMessage,
  backend: SessionBackend,
  senderTabId: number | undefined,
): Promise<SessionResponse | undefined> {
  const store = backend as PageContextBackend;
  if (store.updatePageContext === undefined) {
    return undefined;
  }
  return store.updatePageContext(
    {
      url: message.url,
      pageTitle: message.pageTitle,
      updatedAt: message.updatedAt,
    },
    senderTabId,
  );
}

export function shouldBroadcastPageContextUpdate(
  response: SessionResponse | undefined,
): response is Extract<SessionResponse, { ok: true }> {
  return response !== undefined && response.ok === true;
}
