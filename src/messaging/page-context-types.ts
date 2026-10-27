export const REPORT_PAGE_CONTEXT = 'REPORT_PAGE_CONTEXT' as const;

export type ReportPageContextMessage = {
  type: typeof REPORT_PAGE_CONTEXT;
  url: string;
  pageTitle?: string;
  updatedAt: number;
};
