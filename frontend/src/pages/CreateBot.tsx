import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  Upload,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { File as FileIcon, Trash2, Eye } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authApi } from "../services/api";
import { CreateBotInterface } from "../types";
import { useBot } from "../context/BotContext"; // Use BotContext
import YouTubeUploader from "./YouTubeUploader.tsx";

interface Step {
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

const steps: Step[] = [
  {
    title: "Name Your Bot",
    description: "Give your chatbot a unique and identifiable name.",
    icon: MessageSquare,
  },
  {
    title: "Website Information",
    description:
      "Add your website URL to help your chatbot understand your domain.",
    icon: Globe,
  },
  {
    title: "Knowledge Base",
    description:
      "Upload documents that will serve as the knowledge base for your chatbot.",
    icon: Upload,
  },
];

export const CreateBot = () => {
  const { selectedBot, setSelectedBot } = useBot(); // Use BotContext
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [files, setFiles] = useState<CreateBotInterface[]>([]);
  const [botName, setBotName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [botId, setBotId] = useState<number | null>(null); // Local botId state, resets to null on re-mount
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);
      const newFilesSize = acceptedFiles.reduce(
        (acc, file) => acc + file.size,
        0
      );

      if (totalSize + newFilesSize > MAX_FILE_SIZE) {
        toast.error("File exceeds size limit. Go for subscription.");
        return;
      }

      const newFiles = acceptedFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadDate: new Date(),
        url: URL.createObjectURL(file),
        file: file,
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      toast.success("File added successfully");
    },
    [files, MAX_FILE_SIZE]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      //'application/vnd.ms-excel': ['.xls'],
      //'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      //'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      "text/csv": [".csv"],
    },
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDelete = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const fetchNodes = async (websiteUrl: string) => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL.");
      return;
    }
    setIsLoading(true);
    try {
      const data = await authApi.getWebsiteNodes(websiteUrl);
      if (data.nodes) {
        setNodes(data.nodes);
        setSelectedNodes([]);
      } else {
        setNodes([]);
        toast.error("No nodes found for this website.");
      }
    } catch (error) {
      console.error("Error fetching website nodes:", error);
      toast.error("Failed to fetch website nodes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getPaginatedNodes = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return nodes.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(nodes.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    for (let i = 1; i <= totalPages; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-4 py-2 mx-1 rounded-md ${
            currentPage === i
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  const createBotEntry = async (botName: string) => {
    try {
      const response = await authApi.createBot({
        bot_name: botName,
        status: "In Progress",
        is_active: false,
      });

      if (!response.bot_id) {
        throw new Error("Bot ID not found in response");
      }

      return response.bot_id;
    } catch (error) {
      toast.error("Failed to create bot entry. Please try again.");
      throw error;
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      console.log("Current bot", botId);

      if (!botName.trim()) {
        toast.error("Please enter a bot name.");
        return; // Stop execution if bot name is empty
      }

      // If the bot ID already exists, update the bot name
      if (botId) {
        try {
          await updateBotName(botId, botName);
          setSelectedBot({
            id: botId,
            name: botName,
            status: "In Progress",
            conversations: 0,
            satisfaction: 0,
          }); // Update context
        } catch (error) {
          return;
        }
      } else {
        // If the bot ID doesn't exist, create a new bot entry
        try {
          localStorage.removeItem("youtube_video_urls");
          localStorage.removeItem("selected_videos");
          const newBotId = await createBotEntry(botName);
          setBotId(newBotId); // Update local state
          setSelectedBot({
            id: newBotId,
            name: botName,
            status: "In Progress",
            conversations: 0,
            satisfaction: 0,
          }); // Update context
        } catch (error) {
          return;
        }
      }
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 1) {
      if (selectedNodes.length === 0) {
        toast.error("Please select at least one page to scrape.");
        return;
      }

      setIsLoading(true);

      try {
        const data = await authApi.scrapeNodes(selectedNodes);
        console.log("Scraping result:", data);

        if (data.message === "Scraping completed") {
          setCurrentStep(currentStep + 1);
        } else {
          toast.error("Failed to scrape data. Please try again.");
        }
      } catch (error) {
        console.error("Error scraping website:", error);
        toast.error("An error occurred while scraping. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      // Navigate to Options.tsx when on the first step
      navigate('/Options');
    } else if (currentStep > 0) {
      // Move to the previous step
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > MAX_FILE_SIZE) {
      toast.error("File size exceeds limit. Go for subscription.");
      return;
    }

    setIsLoading(true);
    try {
      const filesToUpload: File[] = files
        .map((file) => file.file)
        .filter((file): file is File => file !== undefined);

      if (filesToUpload.length === 0) {
        toast.error("No valid files to upload.");
        return;
      }

      const response = await authApi.uploadFiles(
        filesToUpload,
        botId as number
      ); // Use local botId
      console.log("Backend response:", response);

      if (response.success) {
        localStorage.removeItem("youtube_video_urls");
        localStorage.removeItem("selected_videos");
        navigate("/chatbot");
      } else {
        toast.error("Failed to upload files.");
      }
    } catch (error) {
      console.error("Error creating bot:", error);
      toast.error("An error occurred while uploading files.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateBotName = async (botId: number, newName: string) => {
    try {
      const response = await authApi.updateBotName({
        bot_id: botId,
        bot_name: newName,
      });
      if (response.success) {
        toast.success("Bot name updated successfully");
      } else {
        toast.error("Failed to update bot name");
      }
    } catch (error) {
      console.error("Error updating bot name:", error);
      toast.error("An error occurred while updating the bot name.");
    }
  };

  const handleCheckboxChange = (url: string) => {
    if (selectedNodes.includes(url)) {
      setSelectedNodes((prev) => prev.filter((node) => node !== url));
    } else {
      if (selectedNodes.length >= 10) {
        toast.error(
          "You are on the Free Tier! Upgrade your subscription to select more pages."
        );
        return;
      }
      setSelectedNodes((prev) => [...prev, url]);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bot Name
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="e.g., Support Assistant"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Website URL
            </label>
            <div className="mt-1 flex">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => fetchNodes(websiteUrl)}
                className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Submit
              </button>
            </div>
            {nodes.length < 1 && (
              <p className="text-sm text-gray-500">
                This will help your chatbot understand your business context
                better.
              </p>
            )}
            {nodes.length > 0 && (
              <p className="text-sm text-gray-500">
                You can select up to <strong>10 pages</strong> for free. Want to
                add more?{" "}
                <a href="/subscription" className="text-blue-500 underline">
                  Upgrade your subscription
                </a>
                .
              </p>
            )}

            {nodes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Pages to Scrape:
                </h4>
                <div className="space-y-2">
                  {getPaginatedNodes().map((node, index) => (
                    <label key={index} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        value={node}
                        checked={selectedNodes.includes(node)}
                        onChange={() => handleCheckboxChange(node)}
                        className="h-5 w-5 text-blue-600 border-gray-400 rounded shrink-0"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {node}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-center mt-4">
                  {renderPaginationButtons()}
                </div>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div>
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Drag and drop files here, or click to select files
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Uploaded Files
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Upload Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {files.map((file) => (
                      <tr
                        key={file.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FileIcon className="w-5 h-5 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 dark:text-white">
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {file.type.split("/")[1].toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {file.uploadDate.toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {/* <button onClick={() => window.open(file.url)} className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-4">
                            <Eye className="w-5 h-5" />
                          </button> */}
                          <button
                            onClick={() => handleDelete(file.id)}
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* YouTube Upload Section */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Add YouTube videos
              </h2>
              {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your playlist URL.
              </p> */}
              <YouTubeUploader />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 py-8">
      <ToastContainer />
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.title} className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                  index <= currentStep
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                <step.icon className="w-6 h-6" />
              </div>
              <p
                className={`mt-2 text-xs font-medium ${
                  index <= currentStep ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {step.title}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {steps[currentStep].title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {steps[currentStep].description}
          </p>
          {renderStepContent()}
        </div>

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            //disabled={currentStep === 0}
            className={`flex items-center px-6 py-2 ${
              isLoading ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
            } text-white rounded-lg`}
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </button>
          <button
            onClick={handleNext}
            disabled={isLoading}
            className={`flex items-center px-6 py-2 ${
              isLoading ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
            } text-white rounded-lg`}
          >
            {isLoading ? (
              "Processing..."
            ) : currentStep === steps.length - 1 ? (
              "Finish"
            ) : (
              <>
                <ArrowRight className="w-5 h-5 ml-2" /> Next
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
