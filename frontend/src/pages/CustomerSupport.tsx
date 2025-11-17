import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { ArrowLeft, Trash2 } from "lucide-react";
import { authApi } from "../services/api";

export const CustomerSupportRequest = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    country: "",
    description: "",
    phone: "",
    files: [] as File[],
    requestType: "support" as "demo" | "support",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();

  const MAX_FILE_SIZE = 2 * 1024 * 1024; 
  const MAX_TOTAL_SIZE = 2 * 1024 * 1024;
  const MAX_DESCRIPTION_LENGTH = 50000; 

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Handle character limit for description
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
      console.log(`File "${file.name}" already exists.`);
      toast.error(`File "${file.name}" already exists. Please upload a file with a unique name.`);
      return false;
    }
  
      return true;
    });
  
    // Calculate total size if new files are added
    const newFilesSize = validFiles.reduce((acc, file) => acc + file.size, 0);
  
    if (totalExistingSize + newFilesSize > MAX_TOTAL_SIZE) {
      toast.error(`Total file size exceeds the ${MAX_TOTAL_SIZE / (1024 * 1024)}MB limit. File(s) not added.`);
      return; 
    }
      // If there are valid files, add them to the state and show success message
    if (validFiles.length > 0) {
      setFormData((prev) => ({
        ...prev,
        files: [...prev.files, ...validFiles],
      }));
      toast.success("Files added successfully");
    }
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = formData.files.filter((_, i) => i !== index);
    setFormData((prev) => ({
      ...prev,
      files: updatedFiles,
    }));
    toast.success("File removed successfully");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLoading) return;

    if (!formData.name || !formData.email || !formData.country || !formData.description) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsLoading(true);

    try {
      const formDataPayload = new FormData();
      formDataPayload.append("name", formData.name);
      formDataPayload.append("email", formData.email);
      formDataPayload.append("country", formData.country);
      formDataPayload.append("description", formData.description);
      formDataPayload.append("phone", formData.phone || "");
      formDataPayload.append("requestType", formData.requestType);

      if (formData.files.length > 0) {
        formData.files.forEach((file) => {
          formDataPayload.append("files", file);
        });
      }

      await authApi.submitDemoRequest(formDataPayload);

      setIsSubmitted(true);
      //setTimeout(() => navigate("/login"), 2000);
    } catch (error) {
      console.error("Error submitting support request:", error);
      toast.error("Failed to submit support request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <ToastContainer
        position="top-right"
        autoClose={3000}
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
          <h2 className="text-2xl font-bold text-blue-900">Thank You!</h2>
          <p className="mt-2 text-sm text-blue-600">
            Your support request has been submitted successfully. We will contact you shortly.
          </p>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
          {/* <button
            onClick={handleGoBack}
            className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="text-sm">Back</span>
          </button> */}

          <h2 className="text-xl font-semibold text-gray-800 mb-4">Request Customer Support</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                Country *
              </label>
              <input
                id="country"
                name="country"
                type="text"
                required
                value={formData.country}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                id="description"
                name="description"
                required
                value={formData.description}
                onChange={handleChange}
                maxLength={MAX_DESCRIPTION_LENGTH}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={5}
              />
            <div className="text-right text-xs text-gray-500 mt-1">
                {formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters
              </div>
            </div>

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


              {formData.files.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-1">Selected Files:</h3>
                  <ul className="space-y-1">
                    {formData.files.map((file, index) => (
                      <li
                        key={index}
                        className="flex items-center justify-between p-1 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-700">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-600 hover:text-red-800"
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
            >
              {isLoading ? "Submitting..." : "Submit"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};