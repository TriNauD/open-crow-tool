const NOTEBOOK_MULTI_USER_ENABLED = process.env.NOTEBOOK_MULTI_USER_ENABLED;

export function isNotebookMultiUserEnabled(): boolean {
  // Default on in dev/staging; set to false for emergency rollback.
  return NOTEBOOK_MULTI_USER_ENABLED !== 'false';
}
