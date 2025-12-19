/**
 * Returns the dedicated modal portal target.
 *
 * Electron/Chromium can sometimes mis-layer fixed overlays when other parts of
 * the UI use backdrop-filter (e.g. glass sidebars). Portaling into a separate
 * top-most stacking context avoids modals slipping behind the server rail.
 */
export function getModalRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (document.getElementById('modal-root') as HTMLElement | null) ?? document.body;
}
