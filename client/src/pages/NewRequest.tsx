import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, FileUp, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { calculateBusinessDays } from "@/lib/date-utils";
import { toast } from "sonner";

export default function NewRequest() {
  const [, navigate] = useLocation();
  const types = trpc.leaveTypes.list.useQuery();
  const upload = trpc.attachments.upload.useMutation();
  const create = trpc.leaveRequests.create.useMutation();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startHalfDay, setStartHalfDay] = useState(false);
  const [endHalfDay, setEndHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selectedType = types.data?.find(type => String(type.id) === leaveTypeId);
  const totalDays = useMemo(() => calculateBusinessDays(startDate, endDate, startHalfDay, endHalfDay), [startDate, endDate, startHalfDay, endHalfDay]);

  if (types.isLoading) return <div className="state-card">Loading leave types…</div>;
  if (types.isError) return <div className="state-card error-state">Unable to load leave policies.</div>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!leaveTypeId || !startDate || !endDate || reason.trim().length < 5 || totalDays <= 0) { toast.error("Complete the required fields and choose at least one working day."); return; }
    setSubmitting(true);
    try {
      let attachment: { key: string; name: string; type: string; size: number } | undefined;
      if (file) {
        const data = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
        const stored = await upload.mutateAsync({ fileName: file.name, contentType: file.type, dataBase64: base64 });
        attachment = { key: stored.key, name: stored.name, type: stored.type, size: stored.size };
      }
      const created = await create.mutateAsync({ leaveTypeId: Number(leaveTypeId), startDate, endDate, startHalfDay, endHalfDay, reason: reason.trim(), attachment });
      toast.success(`${created.requestNumber} submitted to your Direct Manager.`);
      navigate(`/requests/${created.id}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Request could not be submitted."); } finally { setSubmitting(false); }
  };

  return <div className="form-page"><Link href="/requests" className="back-link"><ArrowLeft size={15} /> Back to requests</Link><section className="page-intro compact-intro"><div><p className="eyebrow">New request</p><h1>Take some time.</h1><p className="page-lead">Your request will move through Direct Manager → General Manager → HR.</p></div><div className="form-total"><span>Total days</span><strong>{totalDays || "—"}</strong></div></section><form className="form-layout" onSubmit={submit}><section className="content-panel form-panel"><div className="form-section"><div className="section-heading"><CalendarDays size={18} /><div><h2>When are you away?</h2><p>Weekends and configured public holidays are excluded automatically.</p></div></div><div className="field-grid"><label className="field-label">Leave type<select className="field-input" value={leaveTypeId} onChange={event => setLeaveTypeId(event.target.value)}><option value="">Select leave type</option>{types.data?.map(type => <option value={type.id} key={type.id}>{type.name} · {type.annualAllowance} days/year</option>)}</select></label><span /><label className="field-label">Start date<input className="field-input" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className="field-label">End date<input className="field-input" type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} /></label></div><div className="checkbox-row"><label><input type="checkbox" checked={startHalfDay} onChange={event => setStartHalfDay(event.target.checked)} /> Start as half day</label><label><input type="checkbox" checked={endHalfDay} onChange={event => setEndHalfDay(event.target.checked)} /> End as half day</label></div></div><div className="form-section"><div className="section-heading"><FileUp size={18} /><div><h2>Give some context</h2><p>Keep the approval chain moving with a clear note.</p></div></div><label className="field-label">Reason / notes<textarea className="field-input field-textarea large" value={reason} onChange={event => setReason(event.target.value)} placeholder="What is this leave for?" maxLength={2000} /></label><label className="upload-box"> <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={event => setFile(event.target.files?.[0] ?? null)} /><Paperclip size={18} /><span>{file ? file.name : selectedType?.requiresAttachment ? "Attach a medical certificate (required)" : "Attach a supporting document (optional)"}</span><small>PDF, JPG, or PNG · up to 5 MB</small></label></div><div className="form-actions"><Link href="/requests"><Button type="button" variant="outline">Cancel</Button></Link><Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit for review"} {!submitting && <CheckCircle2 size={16} />}</Button></div></section><aside className="form-aside"><div className="aside-card"><p className="eyebrow">What happens next</p><div className="aside-step"><strong>01</strong><span><b>Direct Manager</b><small>First-line review</small></span></div><div className="aside-step"><strong>02</strong><span><b>General Manager</b><small>Department review</small></span></div><div className="aside-step"><strong>03</strong><span><b>HR</b><small>Final decision and balance update</small></span></div><div className="aside-note">Once submitted, you can track every handoff from the request detail page.</div></div></aside></form></div>;
}
