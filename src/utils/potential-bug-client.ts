import type {
  PotentialBug,
  PotentialBugStatus,
} from '@/src/domain/potential-bug';
import {
  CAPTURE_BUG_NOW,
  GET_POTENTIAL_BUGS,
  POTENTIAL_BUGS_UPDATED,
  SET_POTENTIAL_BUG_STATUS,
  type PotentialBugResponse,
} from '@/src/messaging/potential-bug-types';
import { browser } from 'wxt/browser';

export const POTENTIAL_BUG_SYNC_FAILED_MESSAGE =
  'Could not load potential bugs for this session.';

export const POTENTIAL_BUG_SAVE_FAILED_MESSAGE = 'Could not capture the bug.';

async function sendPotentialBugMessage(
  message: Record<string, unknown>,
): Promise<PotentialBugResponse> {
  const response: unknown = await browser.runtime.sendMessage(message);
  if (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    (('bugs' in response && response.ok === true) ||
      ('error' in response && response.ok === false))
  ) {
    return response as PotentialBugResponse;
  }
  throw new Error(POTENTIAL_BUG_SAVE_FAILED_MESSAGE);
}

export const potentialBugClient = {
  async getBugs(): Promise<PotentialBug[]> {
    const response = await sendPotentialBugMessage({
      type: GET_POTENTIAL_BUGS,
    });
    if (!response.ok) {
      throw new Error(POTENTIAL_BUG_SYNC_FAILED_MESSAGE);
    }
    return response.bugs;
  },

  captureBugNow(input: { note?: string }): Promise<PotentialBugResponse> {
    return sendPotentialBugMessage({ type: CAPTURE_BUG_NOW, note: input.note });
  },

  setStatus(
    bugId: string,
    status: PotentialBugStatus,
  ): Promise<PotentialBugResponse> {
    return sendPotentialBugMessage({
      type: SET_POTENTIAL_BUG_STATUS,
      bugId,
      status,
    });
  },

  subscribe(listener: (bugs: PotentialBug[]) => void): () => void {
    const handler = (message: unknown): void => {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        (message as Record<string, unknown>).type === POTENTIAL_BUGS_UPDATED &&
        'bugs' in message
      ) {
        listener((message as { bugs: PotentialBug[] }).bugs);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => {
      browser.runtime.onMessage.removeListener(handler);
    };
  },
};
