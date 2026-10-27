type IssueCategoryCountsLineProps = {
  uiCount: number;
  consoleCount: number;
  networkCount: number;
};

export function IssueCategoryCountsLine({
  uiCount,
  consoleCount,
  networkCount,
}: IssueCategoryCountsLineProps) {
  const parts: string[] = [];
  if (uiCount > 0) {
    parts.push(`UI ${uiCount}`);
  }
  if (consoleCount > 0) {
    parts.push(`Console ${consoleCount}`);
  }
  if (networkCount > 0) {
    parts.push(`Network ${networkCount}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return (
    <p className="text-xs text-slate-600 dark:text-slate-300">
      {parts.join(' · ')}
    </p>
  );
}
