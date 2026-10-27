import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/src/components/Button';

type UiIssueRulesPanelErrorBoundaryProps = {
  children: ReactNode;
  onReload: () => void;
};

type UiIssueRulesPanelErrorBoundaryState = {
  hasError: boolean;
};

export class UiIssueRulesPanelErrorBoundary extends Component<
  UiIssueRulesPanelErrorBoundaryProps,
  UiIssueRulesPanelErrorBoundaryState
> {
  override state: UiIssueRulesPanelErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): UiIssueRulesPanelErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('UI issue rules panel render failed.', error, info);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false });
    this.props.onReload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-950 dark:text-slate-50">
            UI issue rules could not be displayed.
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={this.handleReload}
            >
              Reload rules
            </Button>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
