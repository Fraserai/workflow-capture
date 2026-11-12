export default function SettingsPage() {
  return (
    <div className="console-page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="settings-grid">
        <article className="workspace-frame setting-card">
          <div className="section-label">Access</div>
          <h3>Console login</h3>
          <p>Protected admin shell is active and ready for SSO and role-based access next.</p>
        </article>
        <article className="workspace-frame setting-card">
          <div className="section-label">Capture policy</div>
          <h3>Worker defaults</h3>
          <p>Screenshots are configurable. Raw typed text is excluded by default.</p>
        </article>
        <article className="workspace-frame setting-card">
          <div className="section-label">Devices</div>
          <h3>Recorder shape</h3>
          <p>Worker machines run the menu bar recorder. Diagnostics stay out of the main worker UI.</p>
        </article>
        <article className="workspace-frame setting-card">
          <div className="section-label">Retention</div>
          <h3>Storage controls</h3>
          <p>Retention, exclusions, and policy management belong here as the next backend-backed settings pass.</p>
        </article>
      </section>
    </div>
  );
}
