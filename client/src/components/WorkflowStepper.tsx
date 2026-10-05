import { Check, Circle, LockKeyhole } from "lucide-react";

const stages = ["Submitted", "Manager", "GM", "HR", "Done"];

export function WorkflowStepper({ status, currentStage }: { status: string; currentStage?: string }) {
  const rejected = status.startsWith("Rejected") || status === "Cancelled";
  const current = status === "Approved" ? 4 : status.startsWith("Pending HR") ? 3 : status.startsWith("Pending General") ? 2 : status.startsWith("Pending Manager") ? 1 : rejected ? (status.includes("Manager") && !status.includes("General") ? 1 : status.includes("General") ? 2 : 3) : 0;
  return <div className="workflow-stepper" aria-label="Leave approval workflow">
    {stages.map((stage, index) => { const complete = index < current || status === "Approved"; const active = index === current && !complete; return <div className="workflow-step-wrap" key={stage}><div className={`workflow-step ${complete ? "complete" : ""} ${active ? "active" : ""} ${rejected && index === current ? "rejected" : ""}`}><span>{complete ? <Check size={13} /> : active ? <Circle size={11} /> : <LockKeyhole size={12} />}</span><small>{stage}</small></div>{index < stages.length - 1 && <div className={`workflow-line ${complete ? "complete" : ""}`} />}</div>; })}
    {currentStage && <span className="stepper-context">Current handoff: <strong>{currentStage === "general_manager" ? "General Manager" : currentStage === "manager" ? "Direct Manager" : currentStage === "hr" ? "HR" : "Complete"}</strong></span>}
  </div>;
}
