export type ActionType = 'click' | 'submit' | 'navigation' | 'input' | 'change';

export type SafeElementDescriptor = {
  tagName: string;
  semanticType?: string;
  role?: string;
  accessibleName?: string;
  visibleText?: string;
  testId?: string;
  inputType?: string;
};

type CapturedActionBase = {
  id: string;
  sessionId: string;
  timestamp: number;
  url: string;
  pageTitle?: string;
};

export type ClickCapturedAction = CapturedActionBase & {
  type: 'click';
  element: SafeElementDescriptor;
};

export type SubmitCapturedAction = CapturedActionBase & {
  type: 'submit';
  element: SafeElementDescriptor;
};

export type NavigationCapturedAction = CapturedActionBase & {
  type: 'navigation';
};

export type InputCapturedAction = CapturedActionBase & {
  type: 'input';
  element: SafeElementDescriptor;
  redacted?: true;
};

export type ChangeCapturedAction = CapturedActionBase & {
  type: 'change';
  element: SafeElementDescriptor;
  redacted?: true;
  checked?: boolean;
};

export type CapturedAction =
  | ClickCapturedAction
  | SubmitCapturedAction
  | NavigationCapturedAction
  | InputCapturedAction
  | ChangeCapturedAction;

export type ActionSubmissionPayload = Omit<CapturedAction, 'id'>;
