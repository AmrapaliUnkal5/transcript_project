import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authApi } from "../services/api";
import { IssueRequestData, FileUploadInterface } from "../types";

export const ReportIssue = () => {
  const [formData, setFormData] = useState<IssueRequestData>({
    botName: "",
    description: "",
    files: [], 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  const MAX_FILE_SIZE = 2 * 1024 * 1024; 
  const MAX_TOTAL_SIZE = 2 * 1024 * 1024;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileList = Array.from(files);

    // Check total size of existing files
    const totalExistingSize = formData.files.reduce((acc, file) => acc + file.size, 0);

    // Filter out files that exceed the individual file size limit or have duplicate names
    const validFiles = fileList.filter((file) => {
      // Check if file size exceeds the limit
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB size limit and was not added.`);
        return false;
      }

      // Check if file with the same name already exists
      if (formData.files.some((existingFile) => existingFile.name === file.name)) {
        toast.error(`File "${file.name}" already exists. Please upload a file with a unique name.`);
        return false;
      }

      return true;
    });

    // Calculate total size if new files are added
    const newFilesSize = validFiles.reduce((acc, file) => acc + file.size, 0);

    if (totalExistingSize + newFilesSize > MAX_TOTAL_SIZE) {
      toast.error(`Total file size exceeds the ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit. File(s) not added.`);
      return; // Exit early if total size exceeds the limit
    }

    // If there are valid files, add them to the state and show success message
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

    if (!formData.description) {
      toast.error("Please describe the issue.");
      return;
    }

    setIsLoading(true);

    const formDataPayload = new FormData();
    formDataPayload.append("bot_name", formData.botName || "");
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
    navigate(-1); 
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />

      {isSubmitted ? (
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-blue-900">Thank You!</h2>
          <p className="mt-2 text-sm text-blue-600">
            Your issue request has been submitted successfully. We will contact you shortly.
          </p>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
            {/* Back Button */}
            <button
              onClick={handleGoBack}
              className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 mb-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Form Heading */}
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-6">
              Report a Technical Issue!
            </h2>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Bot Name Field */}
              <div>
                <label
                  htmlFor="botName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Bot Name (Optional)
                </label>
                <input
                  id="botName"
                  name="botName"
                  type="text"
                  placeholder="Optional"
                  value={formData.botName}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Issue Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Describe the issue
                </label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Describe the issue you are facing..."
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={4}
                />
              </div>

              {/* File Upload */}
              <div>
                <label
                  htmlFor="file"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
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
                    <span className="text-white py-3 ">Choose File</span>
                  </label>
                </div>

                {/* Display Uploaded Files */}
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

              {/* Submit Button */}
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

