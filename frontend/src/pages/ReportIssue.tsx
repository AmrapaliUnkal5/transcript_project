import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authApi } from "../services/api";
import { IssueRequestData, FileUploadInterface } from "../types";
import { useEffect } from "react";





export const ReportIssue = () => {
  const [formData, setFormData] = useState<IssueRequestData>({
    issueType: "",
    description: "",
    files: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 2 * 1024 * 1024;
  const MAX_DESCRIPTION_LENGTH = 20000;

  const ISSUE_TYPES = [
    { value: "", label: "Select the issue" },
    { value: "Report a Bug", label: "Report a Bug" },
    { value: "Demo Reuqest", label: "Request a Demo" },
    { value: "Technical Issue", label: "Technical Issue" },
    { value: "Account Issue", label: "Account Issue" },
    { value: "other", label: "Other" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === "description" && value.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);
    const totalExistingSize = formData.files.reduce((acc, file) => acc + file.size, 0);

    const validFiles = fileList.filter((file) => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB size limit and was not added.`);
        return false;
      }
      if (formData.files.some((existingFile) => existingFile.name === file.name)) {
        toast.error(`File "${file.name}" already exists. Please upload a file with a unique name.`);
        return false;
      }
      return true;
    });

    const newFilesSize = validFiles.reduce((acc, file) => acc + file.size, 0);
    if (totalExistingSize + newFilesSize > MAX_TOTAL_SIZE) {
      toast.error(`Total file size exceeds the ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit. File(s) not added.`);
      return;
    }

    if (validFiles.length > 0) {
      const addedFiles = validFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date(),
        url: URL.createObjectURL(file),
        file,
      }));

      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...addedFiles],
      }));
      toast.success("Files added successfully");
    }
  };

  const handleRemoveFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
    toast.success("File removed successfully");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) return;

    if (!formData.issueType) {
      toast.error("Please select an issue type");
      return;
    }

    if (!formData.description) {
      toast.error("Please describe the issue.");
      return;
    }

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`);
      return;
    }

    setIsLoading(true);

    const formDataPayload = new FormData();
    formDataPayload.append("issue_type", formData.issueType);
    formDataPayload.append("description", formData.description);

    if (formData.files.length > 0) {
      formData.files.forEach((file) => {
        if (file.file) {
          formDataPayload.append("files", file.file);
        }
      });
    }

    try {
      await authApi.submitIssueRequest(formDataPayload);
      setIsSubmitted(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (error) {
      console.error("Error submitting issue:", error);
      toast.error("Failed to submit issue. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
  if (window.history.length > 1) {
    navigate(-1);
  } else {
    navigate("/"); // fallback route
  }
};

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer position="top-right" autoClose={5000} />
      {isSubmitted ? (
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-blue-900">Thank You!</h2>
          <p className="mt-2 text-sm text-blue-600">
            Your issue request has been submitted successfully.
          </p>
        </div>
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
            <button
              onClick={handleGoBack}
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 mb-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <h2 className="block text-sm font-medium text-gray-300 mb-2">
              Report an Issue
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="issueType" className="block text-sm font-medium text-gray-300 mb-2">
                  Issue Type *
                </label>
                <select
                  id="issueType"
                  name="issueType"
                  value={formData.issueType}
                  onChange={handleChange}
                  required
                  className="w-full p-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white"
                >
                  {ISSUE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Describe the issue *
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe the issue you are facing..."
                  value={formData.description}
                  onChange={handleChange}
                  required
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  className="w-full p-3 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white"
                  rows={4}
                />
                <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters
                </div>
              </div>

              <div>
                <label htmlFor="file" className="block text-sm font-medium text-gray-300 mb-2">
                  Attach files or screenshots (Max Size 2MB)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="file"
                    name="file"
                    onChange={handleFileChange}
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg"
                    className="hidden"
                  />
                  <label
                    htmlFor="file"
                    className="p-2 border border-gray-300 rounded-lg cursor-pointer bg-blue-600 hover:bg-blue-700"
                  >
                    <span className="text-white py-3">Choose File</span>
                  </label>
                </div>

                {formData.files.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Uploaded Files:
                    </h3>
                    <ul className="space-y-2">
                      {formData.files.map((file, index) => (
                        <li
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="text-red-600 hover:text-red-800 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-all duration-200"
              >
                {isLoading ? "Submitting..." : "Submit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};