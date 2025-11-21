import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Eye } from "lucide-react";

export const TranscriptList: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Array<{
    p_id: string;
    age?: number | null;
    visits: Array<{ id: number; visit_date?: string | null; created_at?: string | null }>;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await transcriptApi.listPatients();
        setPatients(res.patients || []);
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
          <h2 className="text-xl font-semibold">Patient's Records</h2>
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
          ) : patients.length === 0 ? (
            <div className="text-gray-600">No records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3">Patient ID</th>
                    <th className="py-2 px-3">Age</th>
                    <th className="py-2 px-3">Visit</th>
                    <th className="py-2 px-3">View</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => {
                    const visitRows = p.visits && p.visits.length ? p.visits : [];
                    return visitRows.map((v, idx) => (
                      <tr
                        key={`${p.p_id}-${v.id}`}
                        className="border-b hover:bg-gray-50"
                        onClick={() => navigate(`/dashboard/transcript/${v.id}`)}
                      >
                        {idx === 0 && (
                          <td className="py-2 px-3 font-medium align-top" rowSpan={visitRows.length}>
                            {p.p_id}
                          </td>
                        )}
                        {idx === 0 && (
                          <td className="py-2 px-3 align-top" rowSpan={visitRows.length}>
                            {typeof p.age === "number" ? p.age : "-"}
                          </td>
                        )}
                        <td className="py-2 px-3">
                          {v.visit_date ? new Date(v.visit_date).toLocaleDateString() : (v.created_at ? new Date(v.created_at).toLocaleDateString() : "-")}
                        </td>
                        <td className="py-2 px-3">
                          <a
                            href={`/dashboard/transcript/${v.id}`}
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
                    ));
                  })}
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