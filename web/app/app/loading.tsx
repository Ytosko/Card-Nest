export default function AppRouteLoading() {
  return <section aria-busy="true" aria-label="Loading Card Nest page" className="workspace-page route-skeleton" role="status">
    <span className="sr-only">Loading Card Nest page…</span>
    <div className="skeleton-line skeleton-eyebrow" />
    <div className="skeleton-line skeleton-title" />
    <div className="skeleton-line skeleton-copy" />
    <div className="skeleton-grid">
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
    </div>
    <div className="skeleton-panel" />
  </section>;
}
