/** Re-render Lucide icons after dynamic DOM updates (modules + admin inline). */
export function refreshLucide() {
  if (typeof window !== 'undefined' && window.lucide) {
    window.lucide.createIcons();
  }
}
