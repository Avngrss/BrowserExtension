import { describe, expect, it } from 'vitest';
import { DEFAULT_UI_ISSUE_RULES } from '@/src/ui/default-ui-rules';
import { UiRuleStore } from '@/src/ui/ui-rule-store';
import { createMockUiRuleStorage } from '../helpers/mock-ui-rule-storage';
import { isValidCssSelector } from '@/src/ui/selector-validation';

describe('UiRuleStore', () => {
  it('initializes default rules when storage is empty', async () => {
    const storage = createMockUiRuleStorage();
    const store = new UiRuleStore(storage);
    await store.waitUntilReady();

    expect(store.getRules()).toHaveLength(DEFAULT_UI_ISSUE_RULES.length);
  });

  it('saves rules with valid selectors such as [role="alert"]', async () => {
    const storage = createMockUiRuleStorage([...DEFAULT_UI_ISSUE_RULES]);
    const store = new UiRuleStore(storage);
    await store.waitUntilReady();

    const response = await store.saveRule({
      id: 'custom-alert',
      name: 'Generic alert',
      selector: '[role="alert"]',
      severity: 'error',
      enabled: true,
    });

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.rules.some((rule) => rule.id === 'custom-alert')).toBe(
        true,
      );
    }
  });

  it('rejects invalid selectors when saving', async () => {
    const storage = createMockUiRuleStorage([...DEFAULT_UI_ISSUE_RULES]);
    const store = new UiRuleStore(storage);
    await store.waitUntilReady();

    const response = await store.saveRule({
      id: 'bad-rule',
      name: 'Bad',
      selector: '##invalid',
      severity: 'error',
      enabled: true,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.message).not.toBe('The UI issue rule is invalid.');
    }
  });

  it('preserves rule id when editing and toggles only enabled', async () => {
    const storage = createMockUiRuleStorage([...DEFAULT_UI_ISSUE_RULES]);
    const store = new UiRuleStore(storage);
    await store.waitUntilReady();
    const original = store.getRules()[0]!;

    const edited = await store.saveRule({
      ...original,
      name: 'Renamed alert',
      selector: '.error-message',
    });
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      const updated = edited.rules.find((rule) => rule.id === original.id);
      expect(updated?.name).toBe('Renamed alert');
      expect(updated?.selector).toBe('.error-message');
    }

    const toggled = await store.saveRule({
      ...original,
      name: 'Renamed alert',
      selector: '.error-message',
      enabled: false,
    });
    expect(toggled.ok).toBe(true);
    if (toggled.ok) {
      expect(
        toggled.rules.find((rule) => rule.id === original.id)?.enabled,
      ).toBe(false);
    }

    const deleted = await store.deleteRule(original.id);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(deleted.rules.some((rule) => rule.id === original.id)).toBe(false);
      expect(deleted.rules).toHaveLength(DEFAULT_UI_ISSUE_RULES.length - 1);
    }
  });

  it('returns a storage error without mutating rules when persistence fails', async () => {
    const storage = createMockUiRuleStorage([...DEFAULT_UI_ISSUE_RULES]);
    storage.write = () => Promise.reject(new Error('write failed'));
    const store = new UiRuleStore(storage);
    await store.waitUntilReady();
    const before = store.getRules().length;

    const response = await store.saveRule({
      id: 'custom-alert',
      name: 'Generic alert',
      selector: '[role="alert"]',
      severity: 'error',
      enabled: true,
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('STORAGE_ERROR');
    }
    expect(store.getRules()).toHaveLength(before);
  });

  it('does not duplicate default rules after reload when storage is valid', async () => {
    const storage = createMockUiRuleStorage();
    const store = new UiRuleStore(storage);
    await store.waitUntilReady();
    const reloaded = new UiRuleStore(storage);
    await reloaded.waitUntilReady();
    expect(reloaded.getRules()).toHaveLength(DEFAULT_UI_ISSUE_RULES.length);
  });

  it('validates draft selectors for the options page', () => {
    const store = new UiRuleStore(createMockUiRuleStorage());
    expect(
      store.validateDraft({
        name: 'Valid',
        selector: '[role="alert"]',
        severity: 'error',
      }),
    ).toBeUndefined();
    expect(isValidCssSelector('##invalid')).toBe(false);
  });
});
