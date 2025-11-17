import { formatUiDate } from "../utils/date";
import React, { useState, useEffect } from "react";
import { File as FileIcon, Trash2, Eye, Loader2 } from "lucide-react";
import { useBot } from "../context/BotContext";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { authApi } from "../services/api";

interface ScrapedNode {
  id: number;
  url: string;
  title: string;
  nodes_text: string;
  nodes_text_count: number;
  created_at: string;
}

interface YouTubeVideo {
  id: number;
  video_id: string;
  video_title: string;
  video_url: string;
  transcript: string;
  transcript_count: number;
  created_at: string;
}

interface UploadedFile {
  id: number;
  file_name: string;
  file_type: string;
  file_size: string;
  created_at: string;
  content: string;
  word_count: number;
  storage_type: string;
}

const Investigation = () => {
  const { selectedBot } = useBot();
  const { loading, setLoading } = useLoader();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("website");
  const [scrapedNodes, setScrapedNodes] = useState<ScrapedNode[]>([]);
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    if (selectedBot?.id) {
      fetchData();
    }
  }, [selectedBot?.id, activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === "website") {
        if (!selectedBot) return;
        const nodes = await authApi.getScrapedNodes(selectedBot.id);
        setScrapedNodes(nodes);
      } else if (activeTab === "files") {
        if (!selectedBot) return;
        const files = await authApi.getUploadedFiles(selectedBot.id);
        setUploadedFiles(files);
      } else if (activeTab === "youtube") {
        if (!selectedBot) return;
        const videos = await authApi.getYouTubeVideos(selectedBot.id);
        setYoutubeVideos(videos);
      }
    } catch (error) {
      toast.error("Failed to fetch data");
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const viewContent = (type: "website" | "youtube" | "files", content: string, title: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin: 0;
          }
          .download-btn {
            background-color: #5348CB;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
          }
          .download-btn:hover {
            background-color: #4338ca;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 4px;
            border-left: 4px solid #5348CB;
          }
          .content {
          white-space: normal;   
          word-wrap: break-word; 
          line-height: 1.3;      
        }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Extracted Content</h1>
            <a href="${url}" download="${title}.txt" class="download-btn">Download</a>
          </div>
          <h2>${title}</h2>
          <div class="content">${content || "No content available"}</div>
        </div>
      </body>
    </html>
  `;
  
  const newWindow = window.open("", "_blank");
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
};

  if (!selectedBot) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="text-gray-500 dark:text-white text-lg">
          No bot selected.
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ToastContainer autoClose={3000} />
      {/* {loading && <Loader />} */}

      <div
        className="flex justify-between items-center mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm"
        style={{
          border: "1px solid #DFDFDF",
          borderRadius: "0.5rem",
        }}
      >
        <div className="flex items-center">
          <h2
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontWeight: 600,
              color: "#000",
            }}
          >
            Bot Name: {selectedBot?.name || "Untitled Bot"}
          </h2>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="flex border-b border-gray-300 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("website")}
          className={`px-4 py-2 ${
            activeTab === "website"
              ? "border-b-2 border-[color:#5348CB] text-[color:#5348CB]"
              : "text-gray-500"
          }`}
          style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          Website
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 ${
            activeTab === "files"
              ? "border-b-2 border-[color:#5348CB] text-[color:#5348CB]"
              : "text-gray-500"
          }`}
          style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab("youtube")}
          className={`px-4 py-2 ${
            activeTab === "youtube"
              ? "border-b-2 border-[color:#5348CB] text-[color:#5348CB]"
              : "text-gray-500"
          }`}
          style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          YouTube Videos
        </button>
      </div>

      {/* Website Tab Content */}
      {activeTab === "website" && (
        <div>
          <h1
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "20px",
              color: "#333333",
              fontWeight: "bold",
              marginBottom: "20px",
            }}
          >
            Scraped Website Content
          </h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ 
                    backgroundColor: '#EFF0FF',
                    height: '57px',
                    fontFamily: 'Instrument Sans, sans-serif',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: "black"
                  }}>
                    <th className="px-6 py-3 text-left tracking-wider">S.No</th>
                    <th className="px-6 py-3 text-left tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left tracking-wider">URL</th>
                    <th className="px-6 py-3 text-left tracking-wider">Text Count</th>
                    <th className="px-6 py-3 text-left tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-right tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {scrapedNodes.map((node, index) => (
                    <tr
                      key={node.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 ">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {node.title}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={node.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm"
                        >
                          {node.url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {node.nodes_text_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatUiDate(node.created_at)}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => viewContent("website", node.nodes_text, node.title)}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-2"
                          title="View Content"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files Tab Content */}
      {activeTab === "files" && (
        <div>
          <h1
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "20px",
              color: "#333333",
              fontWeight: "bold",
              marginBottom: "20px",
            }}
          >
            Uploaded Files
          </h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ 
                    backgroundColor: '#EFF0FF',
                    height: '57px',
                    fontFamily: 'Instrument Sans, sans-serif',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: "black"
                  }}>
                    <th className="px-6 py-3 text-left tracking-wider">S.No</th>
                    <th className="px-6 py-3 text-left tracking-wider">File Name</th>
                    <th className="px-6 py-3 text-left tracking-wider">Text Count</th>
                    <th className="px-6 py-3 text-left tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-right tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {uploadedFiles.map((file, index) => (
                    <tr
                      key={file.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {file.file_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {file.word_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatUiDate(file.created_at)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => viewContent("files", file.content, file.file_name)}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-2"
                          title="View Content"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* YouTube Tab Content */}
      {activeTab === "youtube" && (
        <div>
          <h1
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "20px",
              color: "#333333",
              fontWeight: "bold",
              marginBottom: "20px",
            }}
          >
            YouTube Videos
          </h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ 
                    backgroundColor: '#EFF0FF',
                    height: '57px',
                    fontFamily: 'Instrument Sans, sans-serif',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: "black"
                  }}>
                    <th className="px-6 py-3 text-left tracking-wider">S.No</th>
                    <th className="px-6 py-3 text-left tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left tracking-wider">URL</th>
                    <th className="px-6 py-3 text-left tracking-wider">Text Count</th>
                    <th className="px-6 py-3 text-left tracking-wider">Created At</th>
                    <th className="px-6 py-3 text-right tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {youtubeVideos.map((video, index) => (
                    <tr
                      key={video.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {video.video_title}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={video.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm"
                        >
                          {video.video_url}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {video.transcript_count || 0}
                        </span>
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatUiDate(video.created_at)}
                        </span>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => viewContent("youtube", video.transcript, video.video_title)}
                          className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400 mr-2"
                          title="View Transcript"
                        >
                            
                          <Eye className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investigation;