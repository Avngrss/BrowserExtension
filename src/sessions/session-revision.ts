export class SessionRevisionTracker {
  private revision = 0;

  getRevision(): number {
    return this.revision;
  }

  commit(): number {
    this.revision += 1;
    return this.revision;
  }

  reset(): void {
    this.revision = 0;
  }
}
