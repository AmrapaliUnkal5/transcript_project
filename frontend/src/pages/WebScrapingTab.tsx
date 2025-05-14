import React, { useState, useEffect } from "react";
//import { Button } from "@/components/ui/button";
//import { Input } from "@/components/ui/input";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
//import { toast } from "react-toastify";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook

import { Trash2, Info } from "lucide-react";
import { toast } from "react-toastify";
import { useLocation } from 'react-router-dom';

// Fix NodeJS type
type Timeout = ReturnType<typeof setTimeout>;

// Add a flag to track if we've shown the notification for this session
let hasShownCreateBotInfoToast = false;

const WebScrapingTab: React.FC = () => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [nodes, setNodes] = useState<string[]>([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const { loading, setLoading } = useLoader();
  //const { selectedBot, setSelectedBot } = useBot(); // Use BotContext
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { selectedBot } = useBot(); // Use BotContext
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [urlToDelete, setUrlToDelete] = useState<string | null>(null);
  const [scrapedWebsiteUrl, setScrapedWebsiteUrl] = useState<string | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  
  const location = useLocation();
  
  // Check if we're in create bot flow
  const isCreateBotFlow = location.pathname.includes('/create-bot');
  
  
  // Reset toast flag when component unmounts or when not in create bot flow
  useEffect(() => {
    if (!isCreateBotFlow) {
      hasShownCreateBotInfoToast = false;
    }
    
    return () => {
      // Reset flag when component unmounts
      hasShownCreateBotInfoToast = false;
    };
  }, [isCreateBotFlow]);

  const [scrapedUrls, setScrapedUrls] = useState<
  { id: number; url: string; title: string; wordCount?: number }[]
>([]);

  // ✅ Move fetchScrapedUrls outside of useEffect so it can be reused
  const fetchScrapedUrls = async () => {
    try {
      setLoading(true);
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }

      const response = await authApi.getScrapedUrls(selectedBot?.id);
      console.log("Response Data:", response);

      if (Array.isArray(response)) {
        const formattedUrls = response.map((item, index) => ({
          id: index + 1,
          url: item.url,
          title: item.title || "No Title",
          wordCount: item.Word_Counts // Add word count from response
        }));

        console.log("Formatted URLs:", formattedUrls);
        setScrapedUrls(formattedUrls); // ✅ Update state correctly
        // Set the first scraped website URL
        if (formattedUrls.length > 0) {
          setScrapedWebsiteUrl(new URL(formattedUrls[0].url).origin);
          console.log("scrapedWebsiteUrl", scrapedWebsiteUrl);
        }
      } else {
        setScrapedUrls([]); // ✅ Ensure it's always an array
      }
    } catch (error) {
      toast.error("Failed to load scraped URLs");
      console.error("Failed to fetch scraped URLs:", error);
      setScrapedUrls([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Call fetchScrapedUrls only when selectedBot changes
  useEffect(() => {
    if (selectedBot?.id) {
      fetchScrapedUrls();
    }
  }, [selectedBot?.id]);

  const handleDeleteClick = (url: string, wordCount: number) => {
  setUrlToDelete(url);
  setWordCountToDelete(wordCount); // Set the word count
  setIsModalOpen(true);
};
  // Add new state
const [wordCountToDelete, setWordCountToDelete] = useState(0);


  // Handle actual delete
  const confirmDelete = async () => {
    if (!urlToDelete || !selectedBot?.id) return;

    try {
      setLoading(true);
      await authApi.deleteScrapedUrl(selectedBot.id, urlToDelete,wordCountToDelete);
      toast.success("URL deleted successfully!");
      fetchScrapedUrls(); // Refresh list
      setScrapedWebsiteUrl(null);
    } catch (error) {
      toast.error("Failed to delete URL.");
      console.error("Delete Error:", error);
    } finally {
      setLoading(false);
      setIsModalOpen(false); // Close modal
      setUrlToDelete(null);
      setWordCountToDelete(0);
    }
  };

  const handleFetchNodes = async () => {
    if (!websiteUrl) return;

    // Restrict changing the website once scraping has started
    if (scrapedWebsiteUrl && new URL(websiteUrl).origin !== scrapedWebsiteUrl) {
      toast.error(
        "You can only scrape from the same website. Delete existing data to scrape a different site."
      );
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.getWebsiteNodes(websiteUrl);
      console.log("Fetched Nodes Response:", response); // Debugging log

      if (response && Array.isArray(response.nodes)) {
        setNodes(response.nodes); // Correctly setting the extracted array
      } else {
        console.error(
          "API response does not contain a valid nodes array:",
          response
        );
      }
    } catch (error) {
      console.error("Error fetching nodes:", error);
    }
    setLoading(false);
  };

  const handleScrape = async () => {
    if (selectedNodes.length === 0) {
      toast.error("Please select at least one page to scrape.");
      return;
    }

    setLoading(true);
    setIsProcessing(true);
    try {
      // Make sure we have a valid bot ID
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        toast.error("Bot ID is missing. Please select a bot first.");
        setIsProcessing(false);
        setLoading(false);
        return;
      }
      
      console.log("Starting async scraping for bot ID:", selectedBot.id);
      
      // Use the async version of scrapeNodes
      const response = await authApi.scrapeNodesAsync(selectedNodes, selectedBot.id);
      console.log("Scraping response:", response);
      
      // Show information about limitations during bot creation if we haven't already
      if (isCreateBotFlow && !hasShownCreateBotInfoToast) {
        toast.info("Web scraping has started. During bot creation, you can only scrape one website. You will be notified when processing is complete.");
        hasShownCreateBotInfoToast = true;
      } else if (!isCreateBotFlow) {
        // Regular info message if not in bot creation flow
        toast.info("Web scraping has started. You will be notified when it's complete.");
      }
      
      setScrapedWebsiteUrl(new URL(websiteUrl).origin);
      setCurrentPage(1); // Reset pagination
      setSelectedNodes([]); // Clear selection
      
      // Store a flag in localStorage to indicate scraping is in progress
      localStorage.setItem("isScraped", "1");
      
    } catch (error) {
      console.error("Error starting web scraping:", error);
      toast.error("An error occurred while starting the scraping process. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxPagesToShow = 5; // Number of page buttons before adding '...'

    if (totalPages <= maxPagesToShow + 2) {
      // If total pages are small, show all buttons
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(renderButton(i));
      }
    } else {
      // Always show first and last page
      buttons.push(renderButton(1));

      if (currentPage > 3) {
        buttons.push(<span key="start-dots">...</span>);
      }

      // Show up to 3 pages around the current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        buttons.push(renderButton(i));
      }

      if (currentPage < totalPages - 2) {
        buttons.push(<span key="end-dots">...</span>);
      }

      buttons.push(renderButton(totalPages));
    }

    return buttons;
  };

  const renderButton = (page: number) => (
    <button
      key={page}
      onClick={() => handlePageChange(page)}
      className={`px-4 py-2 mx-1 rounded-md ${
        currentPage === page
          ? "bg-blue-500 text-white"
          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
      }`}
    >
      {page}
    </button>
  );
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  const getPaginatedNodes = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return nodes.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(nodes.length / itemsPerPage);

  const handleCheckboxChange = (url: string) => {
    if (selectedNodes.includes(url)) {
      setSelectedNodes((prev) => prev.filter((node) => node !== url));
    } else {
      if (selectedNodes.length >= 10) {
        // toast.error(
        //   "You are on the Free Tier! Upgrade your subscription to select more pages."
        // );
        // return;
      }
      setSelectedNodes((prev) => [...prev, url]);
    }
  };

  return (
    <div className="space-y-6">
      {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Website
      </h1> */}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Website Scraper</h2>
        
        {isCreateBotFlow && !hasShownCreateBotInfoToast && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start space-x-2">
            <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              During bot creation, you can only scrape one website. To add more websites, please go to bot settings after creation.
            </p>
          </div>
        )}
        
        <div className="mb-6">
          <label
            htmlFor="websiteUrl"  
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Website URL
          </label>
          <div className="flex space-x-2">
            <input
              id="websiteUrl"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              disabled={loading || isProcessing}
            />
            <button
              onClick={handleFetchNodes}
              disabled={!websiteUrl || loading || isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              Fetch Pages
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-md">
            <h3 className="text-md font-medium text-blue-800 dark:text-blue-200">
              Web Scraping in Progress
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Your website is being processed. You will be notified when it's complete.
            </p>
          </div>
        )}

        {nodes.length > 0 && !isProcessing && (
          <div className="mt-4">
            <div className="flex justify-between mb-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    // Select all nodes on the current page
                    const currentPageNodes = getPaginatedNodes();
                    setSelectedNodes(prev => [
                      ...new Set([...prev, ...currentPageNodes])
                    ]);
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  disabled={loading || isProcessing}
                >
                  Select Page
                </button>
                <button
                  onClick={() => {
                    // Select all nodes across all pages
                    setSelectedNodes(nodes);
                  }}
                  className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  disabled={loading || isProcessing}
                >
                  Select All ({nodes.length})
                </button>
                <button
                  onClick={() => setSelectedNodes([])}
                  className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  disabled={loading || isProcessing}
                >
                  Clear All
                </button>
              </div>
              <div className="text-sm text-gray-600">
                Selected: {selectedNodes.length}
              </div>
            </div>

            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Pages to Scrape:
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
              {getPaginatedNodes().map((node, index) => (
                <label key={index} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    value={node}
                    checked={selectedNodes.includes(node)}
                    onChange={() => handleCheckboxChange(node)}
                    className="h-5 w-5 text-blue-600 border-gray-400 rounded focus:ring-blue-500 dark:focus:ring-blue-700 dark:border-gray-600"
                    disabled={loading || isProcessing}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    <a
                      href={node}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {node}
                    </a>
                  </span>
                </label>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <div className="flex">{renderPaginationButtons()}</div>
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleScrape}
                disabled={selectedNodes.length === 0 || loading || isProcessing}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Scraping
              </button>
            </div>
          </div>
        )}

        {scrapedUrls.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">
              Scraped Pages ({scrapedUrls.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Page Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Word Count
                  </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scrapedUrls.map((item, index) => (
                    <tr
                      key={item.id}
                      className="text-gray-700 dark:text-gray-300"
                    >
                      <td className="border border-gray-300 px-4 py-2 text-gray-900 dark:text-gray-200">
                        {item.title || "No Title"}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {item.url}
                        </a>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
        {item.wordCount?.toLocaleString() || "N/A"}
      </td>

                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <button
                          onClick={() => handleDeleteClick(item.url, item.wordCount || 0)}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                          disabled={loading || isProcessing}
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
        )}

        {/* Confirmation Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Confirm Deletion</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to delete this URL? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebScrapingTab;