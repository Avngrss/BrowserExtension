import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';

export const GET_POTENTIAL_BUGS = 'GET_POTENTIAL_BUGS';
export const CAPTURE_BUG_NOW = 'CAPTURE_BUG_NOW';
export const SET_POTENTIAL_BUG_STATUS = 'SET_POTENTIAL_BUG_STATUS';
export const POTENTIAL_BUGS_UPDATED = 'POTENTIAL_BUGS_UPDATED';

export type GetPotentialBugsMessage = { type: typeof GET_POTENTIAL_BUGS };

export type CaptureBugNowMessage = {
  type: typeof CAPTURE_BUG_NOW;
  note?: string;
};

export type SetPotentialBugStatusMessage = {
  type: typeof SET_POTENTIAL_BUG_STATUS;
  bugId: string;
  status: PotentialBugStatus;
};

export type PotentialBugRequestMessage =
  GetPotentialBugsMessage | CaptureBugNowMessage | SetPotentialBugStatusMessage;

export type PotentialBugsUpdatedMessage = {
  type: typeof POTENTIAL_BUGS_UPDATED;
  bugs: PotentialBug[];
};

export type PotentialBugResponse =
  | { ok: true; bugs: PotentialBug[] }
  | { ok: false; error: { code: string; message: string } };
