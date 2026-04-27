type NotebookMetric =
  | 'auth_failed'
  | 'request_success'
  | 'request_failed'
  | 'guest_migration_success'
  | 'guest_migration_failed';

export function logNotebookMetric(
  metric: NotebookMetric,
  detail: Record<string, unknown> = {}
) {
  console.info(
    JSON.stringify({
      scope: 'notebook_multi_user',
      metric,
      timestamp: new Date().toISOString(),
      ...detail,
    })
  );
}
