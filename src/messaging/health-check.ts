export const HEALTH_CHECK_TYPE = 'HEALTH_CHECK';

export type HealthCheckRequest = {
  type: typeof HEALTH_CHECK_TYPE;
};

export type HealthCheckResponse = {
  status: 'ok';
  source: 'background';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isHealthCheckRequest(
  message: unknown,
): message is HealthCheckRequest {
  return isRecord(message) && message.type === HEALTH_CHECK_TYPE;
}

export function handleHealthCheckMessage(): HealthCheckResponse {
  return {
    status: 'ok',
    source: 'background',
  };
}

/** @deprecated Use handleHealthCheckMessage via background-router. */
export function handleRuntimeMessage(
  message: unknown,
): HealthCheckResponse | undefined {
  if (!isHealthCheckRequest(message)) {
    return undefined;
  }

  return handleHealthCheckMessage();
}
