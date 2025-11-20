import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Eye } from "lucide-react";

export const TranscriptList: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Array<{
    id: number;
    patient_name: string;
    age?: number;
    bed_no?: string;
    phone_no?: string;
    visit_date?: string | null;
    has_audio: boolean;
    has_transcript: boolean;
    has_summary: boolean;
    created_at?: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await transcriptApi.listRecords();
        setRows(res.records || []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Transcript Records</h2>
          <button
            className="px-4 py-2 rounded bg-[#39489D] text-white"
            onClick={() => navigate("/dashboard/transcript/new")}
          >
            New Record
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4">
          {loading ? (
            <div>Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-gray-600">No records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3">Patient</th>
                    <th className="py-2 px-3">Age</th>
                    <th className="py-2 px-3">Visit</th>
                    <th className="py-2 px-3">View</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/dashboard/transcript/${r.id}`)}
                    >
                      <td className="py-2 px-3">{r.patient_name}</td>
                      <td className="py-2 px-3">{r.age ?? "-"}</td>
                      <td className="py-2 px-3">{r.visit_date ? new Date(r.visit_date).toLocaleDateString() : "-"}</td>
                      <td className="py-2 px-3">
                        <a
                          href={`/dashboard/transcript/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open in new tab"
                          className="inline-flex items-center text-[#39489D] hover:opacity-80"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptList;

