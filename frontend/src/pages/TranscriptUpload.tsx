import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { transcriptApi } from "../services/api";
import { Loader2, ChevronDown, Upload, Mic, FileAudio, Sparkles, Save, Plus, X, AlertCircle } from "lucide-react";

// Mock component to demonstrate the improved UI
export default function ImprovedTranscriptUpload() {
  const { id } = useParams();
  const recordId = Number(id);

  // UI toggles
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Record<number, boolean>>({});

  // Data
  const [patientHeader, setPatientHeader] = useState("");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [dynamicLabels, setDynamicLabels] = useState<string[]>(["diagnosis", "prescription"]);
  const [dynamicAnswers, setDynamicAnswers] = useState<Record<string, string>>({});

  // Loading states
  const [uploading, setUploading] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSupported, setRecordingSupported] = useState(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Setup
  useEffect(() => {
    if (!("MediaRecorder" in window)) {
      setRecordingSupported(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!recordId) return;
      const rec = await transcriptApi.getRecord(recordId);
      setPatientHeader(
        `Patient ID: ${rec.p_id}${rec.visit_date ? " · " + new Date(rec.visit_date).toLocaleDateString() : ""}`
      );
      setTranscript(rec.transcript_text || "");
      setSummary(rec.summary_text || "");
      setDynamicAnswers(rec.dynamic_fields || {});
    };
    load();
  }, [recordId]);

  const mimeChoices = [
    "audio/webm",
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/m4a",
    "audio/wav",
    "audio/mp3",
  ];

  const startRecording = async () => {
    if (!recordingSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      for (const c of mimeChoices) {
        if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(c)) {
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
      setShowTranscript(true);
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
      setShowSummary(true);
    } finally {
      setSummarizing(false);
    }
  };

  const handleGenerateFields = async () => {
    if (!recordId) return;
    setGenerating(true);
    try {
      const fields = dynamicLabels.filter(Boolean);
      const res = await transcriptApi.generateFields(recordId, fields);
      setDynamicAnswers((prev) => ({ ...(prev || {}), ...(res.fields || {}) }));
    } finally {
      setGenerating(false);
    }
  };

  // UI below remains the same, handlers are wired
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div
            className="p-4 text-white"
            style={{ background: "linear-gradient(to right, rgb(36, 25, 105), rgb(64, 79, 142))" }}
          >
            <h1 className="text-xl font-semibold">Medical Transcript</h1>
            <div className="flex items-center gap-2 text-white/80">
              <span className="text-sm">{patientHeader}</span>
            </div>
          </div>
        </div>

        {/* Audio Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
              <FileAudio className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Audio Input</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Upload or record patient consultation</p>
            </div>
          </div>

          {/* Upload Area */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 hover:border-blue-500 transition-colors cursor-pointer group">
              <label className="cursor-pointer flex flex-col items-center gap-3">
                <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                  <Upload className="w-6 h-6 text-gray-600 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-700 dark:text-gray-200">Upload Audio File</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">MP3, WAV, M4A, WebM</p>
                </div>
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </label>
            </div>

            <div className="border-2 border-gray-300 dark:border-gray-600 rounded-xl p-4 flex flex-col items-center justify-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-full flex flex-col items-center gap-3 group"
                >
                  <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                    <Mic className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-700 dark:text-gray-200">Record Audio</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Click to start recording</p>
                  </div>
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="p-3 bg-red-500 rounded-full animate-pulse">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
                  </div>
                  <p className="font-medium text-red-600">Recording...</p>
                  <button
                    onClick={stopRecording}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Stop Recording
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              disabled={uploading}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleUploadAndTranscribe}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Audio...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Upload & Transcribe
                </>
              )}
            </button>
            {transcript && (
              <button
                disabled={summarizing}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                onClick={handleSummarize}
              >
                {summarizing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Summarizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Summary
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Transcript Section */}
        {transcript && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <FileAudio className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transcript</h3>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform ${showTranscript ? "rotate-180" : ""}`}
              />
            </button>
            {showTranscript && (
              <div className="px-6 pb-6">
                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                  <textarea
                    className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300"
                    rows={8}
                    value={transcript}
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary Section */}
        {summary && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Summary</h3>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-gray-500 transition-transform ${showSummary ? "rotate-180" : ""}`}
              />
            </button>
            {showSummary && (
              <div className="px-6 pb-6">
                <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-gray-900 dark:to-gray-900 rounded-xl p-4 border border-green-200 dark:border-green-800">
                  <textarea
                    className="w-full bg-transparent border-none resize-none focus:outline-none text-gray-700 dark:text-gray-300"
                    rows={6}
                    value={summary}
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Fields Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Sparkles className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dynamic Fields</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Extract specific information</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors" onClick={() => setDynamicLabels((prev) => [...prev, ""]) }>
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>

          <div className="space-y-3 mb-6">
            {dynamicLabels.map((label, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-750">
                  <input
                    className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Field label (e.g., prescription)"
                    value={label}
                    onChange={(e) => {
                      const newLabel = e.target.value;
                      setDynamicLabels((prev) => {
                        const arr = [...prev];
                        const oldLabel = arr[i];
                        arr[i] = newLabel;
                        setDynamicAnswers((prevAns) => {
                          if (!prevAns) return prevAns as any;
                          if (oldLabel && oldLabel !== newLabel && (prevAns as any)[oldLabel]) {
                            const { [oldLabel]: moved, ...rest } = prevAns as any;
                            return { ...rest, [newLabel]: moved } as any;
                          }
                          return prevAns as any;
                        });
                        return arr;
                      });
                    }}
                  />
                  <button
                    onClick={() => setExpandedFields(prev => ({ ...prev, [i]: !prev[i] }))}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronDown className={`w-5 h-5 transition-transform ${expandedFields[i] ? "rotate-180" : ""}`} />
                  </button>
                  <button className="p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 rounded-lg transition-colors" onClick={() => {
                    const removed = dynamicLabels[i];
                    setDynamicLabels((prev) => prev.filter((_, idx) => idx !== i));
                    setDynamicAnswers((prev) => {
                      const { [removed]: _drop, ...rest } = (prev || {}) as any;
                      return rest as any;
                    });
                    setExpandedFields((prev) => {
                      const { [i]: _rm, ...rest } = prev as any;
                      return rest as any;
                    });
                  }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {expandedFields[i] && (
                  <div className="p-4 bg-white dark:bg-gray-800">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Generated Answer
                    </label>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-gray-700 dark:text-gray-300">
                        {dynamicAnswers[label] || "No answer generated yet."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#39489D] hover:bg-[#323f8a] text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            onClick={handleGenerateFields}
            disabled={generating}
          >
            <Sparkles className="w-5 h-5" />
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
  );
}