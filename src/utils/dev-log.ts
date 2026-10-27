export function logDev(message: string): void {
  if (import.meta.env.DEV) {
    console.info(message);
  }
}
