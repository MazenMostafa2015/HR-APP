import { Clock3, CheckCircle2, CircleX, Ban, ArrowRight } from "lucide-react";

const styles: Record<string, { className: string; icon: typeof Clock3 }> = {
  "Pending Manager Approval": { className: "status-waiting", icon: Clock3 },
  "Pending General Manager Approval": { className: "status-waiting", icon: Clock3 },
  "Pending HR Approval": { className: "status-waiting", icon: Clock3 },
  Approved: { className: "status-approved", icon: CheckCircle2 },
  "Rejected by Manager": { className: "status-rejected", icon: CircleX },
  "Rejected by General Manager": { className: "status-rejected", icon: CircleX },
  "Rejected by HR": { className: "status-rejected", icon: CircleX },
  Cancelled: { className: "status-cancelled", icon: Ban },
};

export function StatusBadge({ status }: { status: string }) {
  const config = styles[status] ?? { className: "status-neutral", icon: ArrowRight };
  const Icon = config.icon;
  return <span className={`status-badge ${config.className}`}><Icon size={13} />{status}</span>;
}

export function stageLabel(status: string) {
  if (status.includes("Manager") && !status.includes("General")) return "Direct Manager";
  if (status.includes("General Manager")) return "General Manager";
  if (status.includes("HR")) return "HR";
  if (status === "Approved") return "Complete";
  if (status === "Cancelled") return "Cancelled";
  return "Submitted";
}
