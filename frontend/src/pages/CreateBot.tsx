import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Globe,
  Upload,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { File as FileIcon, Trash2 } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authApi } from "../services/api";
import { CreateBotInterface } from "../types";
import { useBot } from "../context/BotContext";
import YouTubeUploader from "./YouTubeUploader";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";


interface Step {
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}

interface FileWithCounts extends Omit<CreateBotInterface, 'wordCount' | 'charCount'> {
  wordCount?: number;
  charCount?: number;
  loadingCounts?: boolean;
  error?: string;
  file: File; // Adding this since you're using it in the component
}

const steps: Step[] = [
  {
    title: "Name Your Bot",
    description: "Give your chatbot a unique and identifiable name.",
    icon: MessageSquare,
  },
  {
    title: "Website Information",
    description: "Add your website URL to help your chatbot understand your domain.",
    icon: Globe,
  },
  {
    title: "Knowledge Base",
    description: "Upload documents that will serve as the knowledge base for your chatbot.",
    icon: Upload,
  },
];

export const CreateBot = () => {
  const { selectedBot, setSelectedBot } = useBot();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [files, setFiles] = useState<FileWithCounts[]>([]);
  const [botName, setBotName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loading, setLoading } = useLoader();
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [botId, setBotId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const MAX_WORD_COUNT=50000;
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [totalWordCount, setTotalWordCount] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("Getting things ready for you...");

  const processWordCounts = async (filesToProcess: File[]) => {
    const formData = new FormData();
    filesToProcess.forEach(file => formData.append('files', file));
  
    try {
      const response = await authApi.getWordCount(formData);
      // Ensure we're returning the array of counts
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error("Error getting word counts:", error);
      return []; // Return empty array on error
    }
  };
  

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessingFiles(true);
  
    // 1. First validate individual file sizes
    const oversizedFiles = acceptedFiles.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      toast.error(
        `The files exceed 20MB limit: ${oversizedFiles}`
      );
      setIsProcessingFiles(false);
      return;
    }
  
    try {
      // 2. Process word counts only for valid files
      const counts = await processWordCounts(acceptedFiles);
      
      // 3. Filter files that would exceed word limit
      const validFiles: FileWithCounts[] = [];
      let newTotalWords = totalWordCount;
  
      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const countData = counts[i];
        const fileWords = countData.word_count || 0;
  
        if (newTotalWords + fileWords <= MAX_WORD_COUNT) {
          validFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            uploadDate: new Date(),
            url: URL.createObjectURL(file),
            file: file,
            wordCount: fileWords,
            charCount: countData.character_count,
            loadingCounts: false
          });
          newTotalWords += fileWords;
        } else {
          toast.error(
            `Skipped "${file.name}" - would exceed word limit  ${MAX_WORD_COUNT}`
          );
        }
      }
  
      // 4. Update state with valid files
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles]);
        setTotalWordCount(newTotalWords);
      }
  
    } catch (error) {
      toast.error("Failed to process files");
    } finally {
      setIsProcessingFiles(false);
    }
  }, [totalWordCount, MAX_WORD_COUNT]);


  // const { getRootProps, getInputProps } = useDropzone({
  //   onDrop,
  //   accept: {
  //     "application/pdf": [".pdf"],
  //     "text/plain": [".txt"],
  //     "application/msword": [".doc"],
  //     "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  //     "text/csv": [".csv"],
  //   },
  // });


  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    onDropRejected: (rejectedFiles) => {
      const rejectedFileTypes = rejectedFiles.map(file => {
        const ext = file.file.name.split('.').pop()?.toLowerCase();
        return ext ? `.${ext}` : 'unknown';
      }).join(', ');
      
      toast.error(`Currently we only accept .txt and .pdf files. You tried to upload: ${rejectedFileTypes}`);
    }
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + " " + sizes[i]);
  };

  // const handleDelete = (id: string) => {
  //   setFiles((prev) => prev.filter((file) => file.id !== id));
  // };

  const handleDelete = (id: string) => {
    setFiles(prevFiles => {
      // Filter out the deleted file
      const updatedFiles = prevFiles.filter(file => file.id !== id);
      
      // Recalculate total word count from remaining files
      const newTotalWordCount = updatedFiles.reduce(
        (sum, file) => sum + (file.wordCount || 0),
        0
      );
      
      // Update both files list and word count
      setTotalWordCount(newTotalWordCount);
      return updatedFiles;
    });
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
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
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
    } catch (error: any) {
      // Check if this is a duplicate name error
      if (error.response?.data?.detail === "A bot with this name already exists for the user") {
        throw new Error("DUPLICATE_NAME");
      }
      throw new Error("Failed to create bot entry. Please try again.");
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!botName.trim()) {
        toast.error("Please enter a bot name.");
        return;
      }

      if (botId) {
        // Update existing bot
        const updateSuccess = await updateBotName(botId, botName);
        if (!updateSuccess) return;
        
          setSelectedBot({
            id: botId,
            name: botName,
            status: "In Progress",
            conversations: 0,
            satisfaction: 0,
          });
        } else {
        try {
          localStorage.removeItem("youtube_video_urls");
          localStorage.removeItem("selected_videos");
          const newBotId = await createBotEntry(botName);
          setBotId(newBotId);
          setSelectedBot({
            id: newBotId,
            name: botName,
            status: "In Progress",
            conversations: 0,
            satisfaction: 0,
          });
        } catch (error: any) {
          if (error.message === "DUPLICATE_NAME") {
            toast.error("A bot with this name already exists. Please choose a different name.");
          } else {
            toast.error("Failed to create bot entry. Please try again.");
          }
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
        if (!selectedBot?.id) {
          console.error("Bot ID is missing.");
          return;
        }
        const data = await authApi.scrapeNodes(selectedNodes, selectedBot?.id);
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
      navigate("/Options");
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    const totalWordCount = files.reduce((acc, file) => acc + (file.wordCount || 0), 0);
  
  if (totalWordCount > MAX_WORD_COUNT) {
    toast.error(`Total word count exceeds limit of ${MAX_WORD_COUNT.toLocaleString()}. Please remove some files or upgrade your plan.`);
    return;
  }
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > MAX_FILE_SIZE) {
      toast.error("File size exceeds limit. Go for subscription.");
      return;
    }

    setIsLoading(true);
    setLoading(true);
    try {
      let isUploadSuccess = false;
      let isYouTubeSuccess = false;
      
      const filesToUpload = files.map(file => ({
        file: file.file,
        wordCount: file.wordCount,
        charCount: file.charCount
      }));

      if (filesToUpload.length > 0) {
        const formData = new FormData();
        filesToUpload.forEach(fileData => {
          formData.append('files', fileData.file!);
        });
        formData.append('word_counts', JSON.stringify(filesToUpload.map(f => f.wordCount)));
        formData.append('char_counts', JSON.stringify(filesToUpload.map(f => f.charCount)));
        formData.append('bot_id', botId!.toString());

        const response = await authApi.uploadFilesWithCounts(formData);
        console.log("Backend response:", response);

        if (response.success) {
          isUploadSuccess = true;
          toast.success(`File uploaded successfully!`);
        } else {
          toast.error("Failed to upload files.");
        }
      }

      const savedSelectedVideos = localStorage.getItem("selected_videos");
      const parsedSelectedVideos = savedSelectedVideos
        ? JSON.parse(savedSelectedVideos)
        : [];
      console.log("parsedSelectedVideos", parsedSelectedVideos);

      if (selectedBot?.id && parsedSelectedVideos.length > 0) {
        try {
          const responseyoutube = await authApi.storeSelectedYouTubeTranscripts(
            parsedSelectedVideos,
            selectedBot.id
          );
          if (responseyoutube && Object.keys(responseyoutube).length > 0) {
            const successCount = responseyoutube.stored_videos?.length || 0;
            const failedCount = responseyoutube.failed_videos?.length || 0;

            if (successCount > 0 && failedCount === 0) {
              isYouTubeSuccess = true;
              toast.success(`${successCount} video(s) uploaded successfully!`);
            } else if (successCount >= 0 && failedCount >= 0) {
              isYouTubeSuccess = true;
              toast.warning(
                `${successCount} video(s) uploaded successfully, ${failedCount} failed.`
              );
            }
          }
        } catch (error) {
          console.error("Error processing YouTube videos:", error);
          toast.error("Failed to process YouTube videos.");
        }
      }

      if (selectedBot?.id && (isUploadSuccess || isYouTubeSuccess)) {
        try {
          console.log("updateBotStatusActive");
          await authApi.updateBotStatusActive(selectedBot.id, {
            status: "Active",
            is_active: true,
          });

          setSelectedBot({
            id: selectedBot.id,
            name: botName,
            status: "Active",
            conversations: 0,
            satisfaction: 0,
          });

          toast.success("Bot status updated to Active!");
        } catch (error) {
          console.error("Error updating bot status:", error);
          toast.error("Failed to activate bot.");
        }
      }

      setTimeout(() => {
        localStorage.removeItem("youtube_video_urls");
        localStorage.removeItem("selected_videos");
        navigate("/chatbot");
      }, 7000);
    } catch (error) {
      console.error("Error creating bot:", error);
      toast.error("An error occurred while uploading files.");
    } finally {
      setIsLoading(false);
      setLoading(true);
    }
  };
  const updateBotName = async (botId: number, newName: string): Promise<boolean> => {
    try {
      const response = await authApi.updateBotName({
        bot_id: botId,
        bot_name: newName,
      });
      
      if (response.success) {
        toast.success("Bot name updated successfully");
        return true;
      } else {
        toast.error("Failed to update bot name");
        return false;
      }
    } catch (error: any) {
      console.error("Error updating bot name:", error);
      
      // Check for specific error message from backend
      if (error.response?.data?.detail === "A bot with this name already exists for the user") {
        toast.error(error.response.data.detail);
      } else {
        toast.error("An error occurred while updating the bot name.");
      }
      return false;
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
           
          {/* Knowledge Source Toggle */}
        <div className="pt-6">
          <label className="block text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Knowledge Source
          </label>
          <div className="flex items-center">
            <span className="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Only provided knowledge
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
          <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
           Include external knowledge when needed
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {`When enabled, external knowledge helps answer questions beyond your provided content.`}
        </p>
      </div>
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
              {/* File Dropzone */}
            <div
              {...getRootProps()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors relative"
            >
            <input {...getInputProps()} />
            {isProcessingFiles && (
            <div className="absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
            <p className="text-gray-600">{processingMessage}</p>
            <p className="text-xs text-gray-500 mt-1">This may take a moment...</p>
          </div>
        )}
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or click to select files
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Maximum {MAX_WORD_COUNT.toLocaleString()} words total (PDF and TXT only)
        </p>
      </div>
        
              {/* Word Count Summary */}
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Document Words
                  </span>
                  <span className={`text-sm font-medium ${
                    totalWordCount > MAX_WORD_COUNT 
                      ? 'text-red-500' 
                      : totalWordCount > MAX_WORD_COUNT * 0.8 
                        ? 'text-yellow-500' 
                        : 'text-green-500'
                  }`}>
                    {totalWordCount.toLocaleString()}/{MAX_WORD_COUNT.toLocaleString()}
                  </span>
                </div>
        
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-600">
                  <div 
                    className="h-2.5 rounded-full" 
                    style={{ 
                    width: `${Math.min(100, (totalWordCount / MAX_WORD_COUNT) * 100)}%`,
                    backgroundColor: totalWordCount > MAX_WORD_COUNT 
                    ? '#ef4444' 
                    : totalWordCount > MAX_WORD_COUNT * 0.8 
                    ? '#f59e0b' 
                    : '#10b981'
                    }}
                  ></div>
                </div>
        
                {/* Warning Messages */}
                {totalWordCount > MAX_WORD_COUNT * 0.8 && (
                  <div className={`mt-2 text-xs ${
                    totalWordCount > MAX_WORD_COUNT 
                      ? 'text-red-500 dark:text-red-400' 
                      : 'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {totalWordCount > MAX_WORD_COUNT ? (
                      <>
                        <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                        Limit exceeded! Remove files to continue.
                      </>
                    ) : (
                      <>
                        <ExclamationTriangleIcon className="inline w-4 h-4 mr-1" />
                        Approaching word limit ({Math.round((totalWordCount / MAX_WORD_COUNT) * 100)}%)
                      </>
                    )}
                  </div>
                )}
              </div>
        
              
        
              {/* Uploaded Files Table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mt-4">
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
                          Words
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Chars
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
                      {files.length > 0 ? (
                        files.map((file) => (
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
                                {file.type?.split("/")[1]?.toUpperCase() || 'UNKNOWN'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {file.loadingCounts ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              ) : file.error ? (
                                <span className="text-xs text-red-500">Error</span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {file.wordCount?.toLocaleString() || '0'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {file.loadingCounts ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              ) : file.error ? (
                                <span className="text-xs text-red-500">Error</span>
                              ) : (
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {file.charCount?.toLocaleString() || '0'}
                                </span>
                              )}
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
                              <button
                                onClick={() => handleDelete(file.id)}
                                className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                            No files uploaded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
        
              {/* YouTube Uploader */}
              <div className="mt-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Add YouTube videos
                </h2>
                <YouTubeUploader maxVideos={5} />
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