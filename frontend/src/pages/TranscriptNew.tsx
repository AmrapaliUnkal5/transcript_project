import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { transcriptApi } from "../services/api";

export const TranscriptNew: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    patient_name: "",
    age: "" as string | number,
    bed_no: "",
    phone_no: "",
    visit_date: "",
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSaveAndNext = async () => {
    if (!form.patient_name.trim()) {
      alert("Patient name is required");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        patient_name: form.patient_name,
        age: form.age ? Number(form.age) : undefined,
        bed_no: form.bed_no || undefined,
        phone_no: form.phone_no || undefined,
        visit_date: form.visit_date || undefined,
      };
      const res = await transcriptApi.createRecord(payload);
      navigate(`/dashboard/transcript/upload/${res.record_id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">New Patient Record</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              className="border rounded px-3 py-2"
              placeholder="Patient Name *"
              name="patient_name"
              value={form.patient_name}
              onChange={handleChange}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Age"
              name="age"
              type="number"
              value={form.age}
              onChange={handleChange}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Bed No (optional)"
              name="bed_no"
              value={form.bed_no}
              onChange={handleChange}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Phone No (optional)"
              name="phone_no"
              value={form.phone_no}
              onChange={handleChange}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Visit Date"
              name="visit_date"
              type="date"
              value={form.visit_date}
              onChange={handleChange}
            />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              disabled={saving}
              onClick={handleSaveAndNext}
              className="px-4 py-2 rounded bg-[#39489D] text-white disabled:opacity-60"
            >
              Save & Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptNew;

