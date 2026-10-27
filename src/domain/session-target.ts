export type SessionTargetBinding = {
  targetTabId: number;
  targetUrl: string;
  pageTitle?: string;
  pageContextUpdatedAt?: number;
};

export type SessionTargetFields = SessionTargetBinding;

export const DEFAULT_TEST_SESSION_TARGET: SessionTargetBinding = {
  targetTabId: 42,
  targetUrl: 'https://example.com/',
  pageTitle: 'Example',
};
