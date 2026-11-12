type StatCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="stat-surface">
      <div className="eyebrow">{label}</div>
      <div className="stat-value">{value}</div>
      <p>{detail}</p>
    </article>
  );
}
