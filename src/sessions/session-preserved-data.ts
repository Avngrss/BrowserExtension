export function sessionHasPreservedData(input: {
  actionCount: number;
  potentialIssues: number;
  capturedFrames: number;
  pendingFrames: number;
  hasMark?: boolean;
}): boolean {
  return (
    input.actionCount > 0 ||
    input.potentialIssues > 0 ||
    input.capturedFrames > 0 ||
    input.pendingFrames > 0 ||
    input.hasMark === true
  );
}
