import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { ChevronDown } from "lucide-react";

export const TranscriptDetail: React.FC = () => {
  const { id } = useParams();
  const recordId = Number(id);

  const [data, setData] = useState<{
    id: number;
    patient_name: string;
    age?: number;
    bed_no?: string;
    phone_no?: string;
    visit_date?: string | null;
    audio_path?: string | null;
    transcript_text?: string | null;
    summary_text?: string | null;
    dynamic_fields?: Record<string, string>;
    created_at?: string | null;
  } | null>(null);
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const run = async () => {
      if (!recordId) return;
      const res = await transcriptApi.getRecord(recordId);
      setData(res);
    };
    run();
  }, [recordId]);

  if (!recordId) return <div className="p-6">Invalid record</div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
          {!data ? (
            <div>Loading...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{data.patient_name}</h2>
                <div className="text-sm text-gray-600">
                  Age: {data.age ?? "-"} | Bed: {data.bed_no || "-"} | Phone: {data.phone_no || "-"}
                </div>
                {data.visit_date && (
                  <div className="text-sm text-gray-600">
                    Visit: {new Date(data.visit_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {data.transcript_text && (
                <div className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Transcript</h3>
                    <button
                      className="p-1 rounded hover:bg-gray-100"
                      onClick={() => setShowTranscript((v) => !v)}
                      aria-label="Toggle transcript"
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${showTranscript ? "rotate-180" : "rotate-0"}`}
                      />
                    </button>
                  </div>
                  {showTranscript && (
                    <div className="mt-3">
                      <textarea className="w-full border rounded p-3" rows={8} value={data.transcript_text || ""} readOnly />
                    </div>
                  )}
                </div>
              )}

              {data.summary_text && (
                <div className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Summary</h3>
                    <button
                      className="p-1 rounded hover:bg-gray-100"
                      onClick={() => setShowSummary((v) => !v)}
                      aria-label="Toggle summary"
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${showSummary ? "rotate-180" : "rotate-0"}`}
                      />
                    </button>
                  </div>
                  {showSummary && (
                    <div className="mt-3">
                      <textarea className="w-full border rounded p-3" rows={6} value={data.summary_text || ""} readOnly />
                    </div>
                  )}
                </div>
              )}

              {!!data.dynamic_fields && Object.keys(data.dynamic_fields).length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Dynamic Prompt</h3>
                  <div className="space-y-3">
                    {Object.entries(data.dynamic_fields).map(([k, v]) => {
                      const isOpen = !!expandedFields[k];
                      return (
                        <div key={k} className="border rounded p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">{k}</div>
                            <button
                              className="p-1 rounded hover:bg-gray-100"
                              onClick={() => setExpandedFields((prev) => ({ ...prev, [k]: !prev[k] }))}
                              aria-label={`Toggle ${k}`}
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform ${isOpen ? "rotate-180" : "rotate-0"}`}
                              />
                            </button>
                          </div>
                          {isOpen && (
                            <div className="mt-2">
                              <textarea className="w-full border rounded p-3" rows={4} value={v || ""} readOnly />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranscriptDetail;

