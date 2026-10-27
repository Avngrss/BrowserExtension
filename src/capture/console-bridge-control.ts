import {
  CONSOLE_BRIDGE_CHANNEL,
  CONSOLE_BRIDGE_MESSAGE,
  CONSOLE_BRIDGE_SCHEMA_VERSION,
} from '@/src/capture/console-bridge-constants';

export function postConsoleBridgeActivate(active: boolean): void {
  window.postMessage(
    {
      type: active
        ? CONSOLE_BRIDGE_MESSAGE.ACTIVATE
        : CONSOLE_BRIDGE_MESSAGE.DEACTIVATE,
      channel: CONSOLE_BRIDGE_CHANNEL,
      schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
    },
    '*',
  );
}

export function postConsoleBridgeRequestReady(): void {
  window.postMessage(
    {
      type: CONSOLE_BRIDGE_MESSAGE.REQUEST_READY,
      channel: CONSOLE_BRIDGE_CHANNEL,
      schemaVersion: CONSOLE_BRIDGE_SCHEMA_VERSION,
    },
    '*',
  );
}
