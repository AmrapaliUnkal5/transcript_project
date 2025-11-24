import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Search, Calendar, Plus, Bed, Mail, Phone } from "lucide-react";
import TranscriptQnA from "../components/TranscriptQnA";

export const TranscriptList: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Array<{
    p_id: string;
    medical_clinic?: string | null;
    phone_no?: string | null;
    age?: number | null;
    bed_no?: string | null;
    visits: Array<{ id: number; visit_date?: string | null; created_at?: string | null }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dateOpenFor, setDateOpenFor] = useState<string | null>(null);
  const [newVisitDate, setNewVisitDate] = useState<Record<string, string>>({});
  const [newVisitClinic, setNewVisitClinic] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = q.trim()
          ? await transcriptApi.searchPatients(q.trim())
          : await transcriptApi.listPatients();
        if (!cancelled) setPatients(res.patients || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(load, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const canCreate = (pId: string) => !!(pId && (newVisitDate[pId] || "").trim());

  const startNewVisit = async (p: { p_id: string; medical_clinic?: string | null; phone_no?: string | null; age?: number | null; bed_no?: string | null }) => {
    const picked = (newVisitDate[p.p_id] || "").trim();
    if (!picked) {
      setDateOpenFor(p.p_id);
      return;
    }
    setCreating(p.p_id);
    try {
      const res = await transcriptApi.createRecord({
        p_id: p.p_id,
        medical_clinic: (newVisitClinic[p.p_id] || p.medical_clinic || "").trim() || undefined,
        phone_no: p.phone_no || undefined,
        age: typeof p.age === "number" ? p.age : undefined,
        bed_no: p.bed_no || undefined,
        visit_date: picked,
      });
      navigate(`/dashboard/transcript/upload/${res.record_id}`);
    } finally {
      setCreating(null);
      setDateOpenFor(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <TranscriptQnA recordId={null} disabledReason="Open a patient record to enable QnA" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Patient Records</h2>
          <button
            className="px-4 py-2 rounded bg-[#39489D] text-white"
            onClick={() => navigate("/dashboard/transcript/new")}
          >
            New Record
          </button>
        </div>

        <div className="mb-4">
          <div className="relative max-width[480px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full border rounded pl-9 pr-3 py-2"
              placeholder="Search by Patient ID or Phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4">Loading…</div>
          ) : patients.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 text-gray-600">No patients found.</div>
          ) : (
            patients.map((p) => (
              <div key={p.p_id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500">Patient ID</div>
                    <div className="text-lg font-semibold">{p.p_id}</div>
                    <div className="text-sm text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {typeof p.age === "number" && (
                        <span>Age: {p.age}</span>
                      )}
                      {p.bed_no && (
                        <span className="inline-flex items-center gap-1">
                          <Bed className="w-3 h-3" />
                          {p.bed_no}
                        </span>
                      )}
                      {p.medical_clinic && <span className="inline-flex">{p.medical_clinic}</span>}
                      {p.phone_no && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {p.phone_no}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 px-3 py-2 bg-[#39489D] text-white rounded hover:opacity-90 disabled:opacity-60"
                    onClick={() => setDateOpenFor(dateOpenFor === p.p_id ? null : p.p_id)}
                    disabled={creating === p.p_id}
                  >
                    <Plus className="w-4 h-4" />
                    Record New Visit
                  </button>
                </div>
                <div className="px-4 pb-4">
                  {dateOpenFor === p.p_id && (
                    <div className="mb-3 flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="date"
                          className="pl-9 pr-3 py-2 border rounded"
                          value={newVisitDate[p.p_id] || ""}
                          onChange={(e) => setNewVisitDate((prev) => ({ ...prev, [p.p_id]: e.target.value }))}
                        />
                      </div>
                      <input
                        type="text"
                        className="pr-3 py-2 border rounded px-3"
                        placeholder="Medical Clinic"
                        value={newVisitClinic[p.p_id] || ""}
                        onChange={(e) => setNewVisitClinic((prev) => ({ ...prev, [p.p_id]: e.target.value }))}
                      />
                      <button
                        className="px-3 py-2 rounded bg-[#39489D] text-white disabled:opacity-60"
                        onClick={() => startNewVisit(p)}
                        disabled={!canCreate(p.p_id) || creating === p.p_id}
                      >
                        Start Recording
                      </button>
                      <button
                        className="px-3 py-2 rounded border"
                        onClick={() => setDateOpenFor(null)}
                        disabled={creating === p.p_id}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {p.visits?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {p.visits.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => navigate(`/dashboard/transcript/${v.id}`)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm"
                          title="Open visit"
                        >
                          <Calendar className="w-3 h-3" />
                          {v.visit_date
                            ? new Date(v.visit_date).toLocaleDateString()
                            : v.created_at
                            ? new Date(v.created_at).toLocaleDateString()
                            : "—"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">No visits yet.</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptList;