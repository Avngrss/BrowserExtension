import type { SafeElementDescriptor } from '@/src/domain/action';
import type { UiIssueRule } from '@/src/domain/ui-rule';
import { isElementVisible } from '@/src/ui/element-visibility';
import { buildUiIssueElementDescriptor } from '@/src/ui/ui-element-descriptor';
import {
  normalizeUiMessageForFingerprint,
  readUiVisibleMessage,
} from '@/src/ui/ui-visible-message';

export type UiIssueDetection = {
  rule: UiIssueRule;
  element: SafeElementDescriptor;
  visibleMessage?: string;
};

export type UiIssueDetectorOptions = {
  root: Document;
  onDetection: (detection: UiIssueDetection) => void;
};

const RELEVANT_ATTRIBUTES = [
  'role',
  'aria-invalid',
  'data-testid',
  'data-qa',
  'aria-label',
  'class',
  'hidden',
  'style',
] as const;

function buildElementSnapshot(
  ruleId: string,
  descriptor: SafeElementDescriptor,
  visibleMessage: string | undefined,
): string {
  return [
    ruleId,
    descriptor.semanticType ?? descriptor.tagName,
    normalizeUiMessageForFingerprint(descriptor.accessibleName),
    normalizeUiMessageForFingerprint(visibleMessage),
  ].join('\u0000');
}

export class UiIssueDetector {
  private rules: UiIssueRule[] = [];
  private observer: MutationObserver | null = null;
  private readonly elementSnapshots = new WeakMap<Element, string>();

  constructor(private readonly options: UiIssueDetectorOptions) {}

  isObserving(): boolean {
    return this.observer !== null;
  }

  setRules(rules: readonly UiIssueRule[]): void {
    this.rules = rules.filter((rule) => rule.enabled);
  }

  start(): void {
    this.stop();
    this.runInitialScan();
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });
    this.observer.observe(this.options.root.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [...RELEVANT_ATTRIBUTES],
      characterData: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  runInitialScan(): void {
    for (const rule of this.rules) {
      this.queryMatches(rule).forEach((element) => {
        this.evaluateElement(element, rule);
      });
    }
  }

  private queryMatches(rule: UiIssueRule): Element[] {
    try {
      return Array.from(this.options.root.querySelectorAll(rule.selector));
    } catch {
      return [];
    }
  }

  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.removedNodes) {
          this.clearElementState(node);
        }
        for (const node of mutation.addedNodes) {
          this.scanNode(node);
        }
        continue;
      }

      if (mutation.type === 'attributes') {
        if (mutation.target instanceof Element) {
          this.scanElement(mutation.target);
        }
        continue;
      }

      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent !== null) {
          this.scanElement(parent);
        }
      }
    }
  }

  private clearElementState(node: Node): void {
    if (node instanceof Element) {
      this.elementSnapshots.delete(node);
      node.querySelectorAll('*').forEach((child) => {
        this.elementSnapshots.delete(child);
      });
    }
  }

  private scanNode(node: Node): void {
    if (node instanceof Element) {
      this.scanElement(node);
      return;
    }
    if (node instanceof Text) {
      const parent = node.parentElement;
      if (parent !== null) {
        this.scanElement(parent);
      }
    }
  }

  private scanElement(element: Element): void {
    for (const rule of this.rules) {
      try {
        if (element.matches(rule.selector)) {
          this.evaluateElement(element, rule);
        }
        element.querySelectorAll(rule.selector).forEach((match) => {
          this.evaluateElement(match, rule);
        });
      } catch {
        // Ignore invalid selectors at runtime.
      }
    }
  }

  private evaluateElement(element: Element, rule: UiIssueRule): void {
    if (!isElementVisible(element)) {
      return;
    }

    const visibleMessage = readUiVisibleMessage(element);
    const elementDescriptor = buildUiIssueElementDescriptor(element);
    const snapshot = buildElementSnapshot(
      rule.id,
      elementDescriptor,
      visibleMessage,
    );

    const previousSnapshot = this.elementSnapshots.get(element);
    if (previousSnapshot === snapshot) {
      return;
    }

    this.elementSnapshots.set(element, snapshot);
    this.options.onDetection({
      rule,
      element: elementDescriptor,
      visibleMessage,
    });
  }
}
