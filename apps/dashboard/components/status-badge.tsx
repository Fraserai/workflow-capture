type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status === "processed" ? "Ready" : status === "recording" ? "Recording" : "Stopped";
  return <span className={`status-badge status-${status}`}>{label}</span>;
}
