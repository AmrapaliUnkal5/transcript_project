import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Loader2, ChevronDown } from "lucide-react";

const mimeChoices = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/mp3",
];

export const TranscriptUpload: React.FC = () => {
  const { id } = useParams();
  const recordId = Number(id);

  const [patientHeader, setPatientHeader] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [dynamicLabels, setDynamicLabels] = useState<string[]>(["prescription", "diagnosis"]);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});
  const [showTranscript, setShowTranscript] = useState<boolean>(false);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [expandedFields, setExpandedFields] = useState<Record<number, boolean>>({});

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!("MediaRecorder" in window)) {
      setRecordingSupported(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!recordId) return;
      const rec = await transcriptApi.getRecord(recordId);
      setPatientHeader(`${rec.patient_name}${rec.age ? " · " + rec.age : ""}${rec.visit_date ? " · " + new Date(rec.visit_date).toLocaleDateString() : ""}`);
      setTranscript(rec.transcript_text || "");
      setSummary(rec.summary_text || "");
      setDynamicAnswers(rec.dynamic_fields || {});
    };
    load();
  }, [recordId]);

  const startRecording = async () => {
    if (!recordingSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      for (const c of mimeChoices) {
        if (MediaRecorder.isTypeSupported(c)) {
          mimeType = c;
          break;
        }
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setRecordingSupported(false);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      setIsRecording(false);
    }
  };

  const handleUploadAndTranscribe = async () => {
    if (!recordId) return;
    setUploading(true);
    try {
      let blobToUpload: Blob | null = null;
      let filename = "recording.webm";

      if (selectedFile) {
        blobToUpload = selectedFile;
        filename = selectedFile.name;
      } else if (chunksRef.current.length) {
        const type = (chunksRef.current[0] as any).type || "audio/webm";
        blobToUpload = new Blob(chunksRef.current, { type });
        if (type.includes("ogg")) filename = "recording.ogg";
        else if (type.includes("m4a") || type.includes("mp4")) filename = "recording.m4a";
        else if (type.includes("wav")) filename = "recording.wav";
        else if (type.includes("mp3")) filename = "recording.mp3";
      }

      if (!blobToUpload) {
        alert("No audio to upload. Either upload a file or record audio.");
        return;
      }

      await transcriptApi.uploadAudio(recordId, blobToUpload, filename);
      const t = await transcriptApi.transcribe(recordId);
      setTranscript(t.transcript || "");
    } finally {
      setUploading(false);
    }
  };

  const handleSummarize = async () => {
    if (!recordId) return;
    setSummarizing(true);
    try {
      const res = await transcriptApi.summarize(recordId);
      setSummary(res.summary || "");
    } finally {
      setSummarizing(false);
    }
  };

  const handleGenerateFields = async () => {
    if (!recordId) return;
    setGenerating(true);
    try {
      const res = await transcriptApi.generateFields(recordId, dynamicLabels.filter(Boolean));
      // Merge new field answers with existing to avoid wiping previous answers
      setDynamicAnswers((prev) => ({ ...(prev || {}), ...(res.fields || {}) }));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-1">Upload / Record Audio</h2>
          <div className="text-sm text-gray-600 mb-4">{patientHeader}</div>

          <div className="mt-2">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              {recordingSupported && !isRecording && (
                <button
                  className="px-4 py-2 rounded bg-[#39489D] text-white"
                  onClick={startRecording}
                >
                  Start Recording
                </button>
              )}
              {isRecording && (
                <button className="px-4 py-2 rounded bg-red-600 text-white" onClick={stopRecording}>
                  Stop Recording
                </button>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              disabled={uploading}
              onClick={handleUploadAndTranscribe}
              className="px-4 py-2 rounded bg-[#39489D] text-white disabled:opacity-60"
            >
              {uploading ? (
                <span className="inline-flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                </span>
              ) : (
                "Upload & Transcribe"
              )}
            </button>
            {transcript && (
              <button
                className="px-4 py-2 rounded border disabled:opacity-60"
                onClick={handleSummarize}
                disabled={summarizing}
              >
                {summarizing ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Summarizing...
                  </span>
                ) : (
                  "Summarize"
                )}
              </button>
            )}
          </div>

          {transcript && (
            <div className="mt-6 border rounded p-3">
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
                  <textarea className="w-full border rounded p-3" rows={8} value={transcript} readOnly />
                </div>
              )}
            </div>
          )}

          {summary && (
            <div className="mt-6 border rounded p-3">
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
                  <textarea className="w-full border rounded p-3" rows={6} value={summary} readOnly />
                </div>
              )}
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-medium mb-2">Dynamic Prompt</h3>
            <div className="space-y-4">
              {dynamicLabels.map((lbl, i) => {
                const answer = dynamicAnswers[lbl];
                return (
                  <div key={i} className="border rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        className="border rounded px-3 py-2 flex-1"
                        placeholder="Field label (e.g., prescription)"
                        value={lbl}
                        onChange={(e) => {
                          const newLabel = e.target.value;
                          setDynamicLabels((prev) => {
                            const arr = [...prev];
                            const oldLabel = arr[i];
                            arr[i] = newLabel;
                            // If there was an answer under old label, migrate to new label key
                            setDynamicAnswers((prevAns) => {
                              if (!prevAns) return prevAns;
                              if (oldLabel && oldLabel !== newLabel && prevAns[oldLabel]) {
                                const { [oldLabel]: moved, ...rest } = prevAns;
                                // Only set if new label not already answered
                                return { ...rest, [newLabel]: moved };
                              }
                              return prevAns;
                            });
                            return arr;
                          });
                        }}
                      />
                      <button
                        className="p-1 rounded hover:bg-gray-100"
                        onClick={() =>
                          setExpandedFields((prev) => ({ ...prev, [i]: !prev[i] }))
                        }
                        aria-label="Toggle field"
                      >
                        <ChevronDown
                          className={`w-5 h-5 transition-transform ${expandedFields[i] ? "rotate-180" : "rotate-0"}`}
                        />
                      </button>
                      <button
                        className="px-2 py-2 rounded border"
                        onClick={() => {
                          const removed = dynamicLabels[i];
                          const arr = dynamicLabels.filter((_, idx) => idx !== i);
                          setDynamicLabels(arr);
                          // Remove any existing answer tied to this label
                          setDynamicAnswers((prev) => {
                            const { [removed]: _drop, ...rest } = prev;
                            return rest;
                          });
                          setExpandedFields((prev) => {
                            const { [i]: _dropIdx, ...rest } = prev;
                            return rest;
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    {expandedFields[i] && (
                      <div className="mt-3">
                        <div className="text-sm text-gray-600 mb-1">Answer</div>
                        <textarea
                          className="w-full border rounded p-3"
                          rows={4}
                          value={answer || "No answer yet."}
                          readOnly
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                className="px-3 py-2 rounded border"
                onClick={() => setDynamicLabels((a) => [...a, ""])}
              >
                Add Field
              </button>
            </div>
            <div className="mt-3">
              <button
                className="px-4 py-2 rounded bg-[#39489D] text-white disabled:opacity-60"
                onClick={handleGenerateFields}
                disabled={generating}
              >
                {generating ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                  </span>
                ) : (
                  "Generate Answers"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptUpload;

