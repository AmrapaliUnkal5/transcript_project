import React, { useState, useEffect, useCallback } from "react";
//import { Button } from "@/components/ui/button";
//import { Input } from "@/components/ui/input";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
//import { toast } from "react-toastify";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import { AlertTriangle } from "lucide-react";
import { Trash2, Info } from "lucide-react";
import { toast } from "react-toastify";
import { useLocation } from 'react-router-dom';
import { Search, Filter } from "lucide-react";


// Fix NodeJS type
type Timeout = ReturnType<typeof setTimeout>;

// Add a flag to track if we've shown the notification for this session
let hasShownCreateBotInfoToast = false;

interface WebScrapingTabProps {
  selectedNodes: string[];
  setSelectedNodes: React.Dispatch<React.SetStateAction<string[]>>;
  nodes: string[];
  setNodes: React.Dispatch<React.SetStateAction<string[]>>;
  onChangesMade?: () => void;
  onSaveComplete?: () => void;
  websiteUrl?: string;
  setWebsiteUrl?: (url: string) => void;
  isReconfiguring?: boolean; 
  disableActions?: boolean; 
 isCreateBotFlow?:boolean;
 disableActions2?:boolean;
 setRefetchScrapedUrls?: React.Dispatch<React.SetStateAction<(() => void) | undefined>>;
 onScrapeButtonVisibility?: (isVisible: boolean) => void;
 onReset?: (resetFunc: () => void) => void;
}

const WebScrapingTab: React.FC<WebScrapingTabProps> = ({ 
  // selectedNodes, 
  // setSelectedNodes ,
  // nodes,
  // setNodes,
  // onChangesMade,
  selectedNodes = [], 
  setSelectedNodes = () => {},
  nodes = [],
  setNodes = () => {},
  onChangesMade,
  isReconfiguring = false, 
  disableActions = false,
  disableActions2 = false,
  setRefetchScrapedUrls,
  onScrapeButtonVisibility,
  onReset = () => {},
}) => {
  
  const [websiteUrl, setWebsiteUrl] = useState("");
  //const [nodes, setNodes] = useState<string[]>([]);
  //const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
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
  const [searchTerm, setSearchTerm] = useState("");
  
  // Check if we're in create bot flow
  const isCreateBotFlow = location.pathname.includes('/dashboard/create-bot');
  const [scrapedSearchTerm, setScrapedSearchTerm] = useState("");
  const [scrapedStatusFilter, setScrapedStatusFilter] = useState("all");
  

  useEffect(() => {
    if (onScrapeButtonVisibility) {
      onScrapeButtonVisibility(nodes.length > 0 && selectedNodes.length > 0 && !isProcessing);
    }
  }, [nodes.length, selectedNodes.length, isProcessing, onScrapeButtonVisibility]);
  
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
  { id: number; url: string; title: string; wordCount?: number;upload_date?:string;status?: string ,error_code?: string }[]
>([]);

  // ✅ Move fetchScrapedUrls outside of useEffect so it can be reused
  const fetchScrapedUrls = useCallback(async () => {
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
          wordCount: item.Word_Counts, // Add word count from response
          upload_date:item.upload_date,
          status: item.status,
          error_code:item.error_code
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
      setIsProcessing(false);
    }
  }, [selectedBot?.id]);

  // ✅ Call fetchScrapedUrls only when selectedBot changes
  useEffect(() => {
    if (selectedBot?.id) {
      fetchScrapedUrls();
    }
  }, [selectedBot?.id]);
  
  useEffect(() => {
  if (setRefetchScrapedUrls) {
    setRefetchScrapedUrls(() => fetchScrapedUrls);
  }
}, [fetchScrapedUrls, setRefetchScrapedUrls]);

const resetInternalState = () => {
    // Reset selected nodes and URLs
    setSelectedNodes([]);
    setNodes([]);
    setWebsiteUrl("");
  };

  // Expose reset function to parent
  useEffect(() => {
    if (onReset) {
      onReset(resetInternalState);
    }
  }, [onReset]);

    const handleDeleteClick = (url: string, wordCount: number) => {
  setUrlToDelete(url);
  setWordCountToDelete(wordCount); // Set the word count
  setIsModalOpen(true);
};
  // Add new state
const [wordCountToDelete, setWordCountToDelete] = useState(0);
const filteredScrapedUrls = React.useMemo(() => {
  return scrapedUrls.filter((item) => {
    const matchesSearch =
      (item.title || "").toLowerCase().includes(scrapedSearchTerm.toLowerCase()) ||
      (item.url || "").toLowerCase().includes(scrapedSearchTerm.toLowerCase());

    const matchesStatus =
      scrapedStatusFilter === "all" ||
      (item.status || "").toLowerCase() === scrapedStatusFilter;

    return matchesSearch && matchesStatus;
  });
}, [scrapedUrls, scrapedSearchTerm, scrapedStatusFilter]);


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
    setSearchTerm('');
    if (!websiteUrl) return;

    if (!disableActions && !isReconfiguring) {
    toast.error("Please click Reconfigure first before adding website URLs");
    return;
  }
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
        if (response.nodes.length === 0) {
                  toast.error("No valid pages found for this website.");
                   }
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
        toast.info("Your website content is being prepared. You'll receive a notification when it's ready to use.");
        hasShownCreateBotInfoToast = true;
      } else if (!isCreateBotFlow) {
        // Regular info message if not in bot creation flow
        toast.info("Your website content is being prepared. You'll receive a notification when it's ready to use.");
      }
      
      setScrapedWebsiteUrl(new URL(websiteUrl).origin);
      setCurrentPage(1); // Reset pagination
      setSelectedNodes([]); // Clear selection
      setNodes([])
      
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

    const handleDeepScan = async () => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL to perform deep scanning.");
      return;
    }
    setLoading(true);
    try {
      const deepLinks = await authApi.sitemapDeepScan(websiteUrl);
      console.log("Deep Scanning links:", deepLinks);
      if (Array.isArray(deepLinks) && deepLinks.length > 0) {
        setNodes(deepLinks);
        toast.success(`Deep Scan complete! Found ${deepLinks.length} pages.`);
      } else {
        toast.info("No new pages were identified during the Deep Scan.");
      }
    } catch (error) {
      console.error("Deep scan failed:", error);
      toast.error("Deep Scanning failed. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredNodes = () => {
  return nodes.filter((node) =>
    node.toLowerCase().includes(searchTerm.toLowerCase())
  );
  };

  const getPaginatedNodes = () => {
    const filtered = getFilteredNodes();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(nodes.length / itemsPerPage);

  const handleCheckboxChange = (url: string) => {
    if (!disableActions && !isReconfiguring) {
      toast.error("Please click Reconfigure first before selecting pages");
      return;
    }
    if (selectedNodes.includes(url)) {
    //const newSelectedNodes = selectedNodes.filter((node) => node !== url);
      setSelectedNodes((prev) => prev.filter((node) => node !== url));
    } else {
      if (selectedNodes.length >= 10) {
        // toast.error(
        //   "You are on the Free Tier! Upgrade your subscription to select more pages."
        // );
        // return;
      }
      //const newSelectedNodes = [...selectedNodes, url];
      setSelectedNodes((prev) => [...prev, url]);
    }
    if (onChangesMade) onChangesMade();
  };

  return (
    <div className="space-y-6">
      {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Website
      </h1> */}

      <div className="bg-white dark:bg-gray-800 rounded-lg pt-6 pb-6 pr-6 ">
        
        <div className="mb-6">
          
          <div className="flex space-x-2">
            <input
              id="websiteUrl"
              type="url"
              placeholder="  Website URL"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className={`block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            (isCreateBotFlow && disableActions2) ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
               required
              disabled={(isCreateBotFlow && disableActions2) || loading || isProcessing}
            />
            <button
              onClick={handleFetchNodes}
              disabled={(isCreateBotFlow && disableActions2) ||!websiteUrl || loading || isProcessing}
               style={{
    backgroundColor: '#5348CB',
    borderColor: '#5348CB',
  }}
            className={`px-4 py-2 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:cursor-not-allowed flex-shrink-0 ${
            (isCreateBotFlow && disableActions2) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600'
          }`}
              >
              Fetch Pages
            </button>
          </div>
        </div>
 {isCreateBotFlow && !hasShownCreateBotInfoToast && (
          <div className="mb-4 p-3   rounded-md flex items-start space-x-2">
            {/* <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5" /> */}
            <p className="text-sm text-#666666-700 fontsize-14 "  style={{
    color: '#666666',
    fontSize: '14px',
    fontFamily: 'Instrument Sans',
  }}>
              During bot creation, you can only scrape one website. To add more websites, please go to bot settings after creation.
            </p>
          </div>
        )}
        

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
             <div className="flex flex-wrap md:flex-nowrap justify-between items-center mb-2 gap-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                const filtered = getFilteredNodes();
                setSelectedNodes(filtered);
                if (onChangesMade) {
                  onChangesMade();}
              }}
              className="px-3 py-1 text-black  rounded hover:bg-[#5348CB] font-instrument min-w-[120px] transition-all whitespace-nowrap"
              disabled={loading || isProcessing}
              style={{
                         backgroundColor: selectedNodes.length === nodes.length ? '#e5e7eb' : '#5348CB',
                         color: selectedNodes.length === nodes.length ? '#000000' : '#ffffff',
                          }}
            >
              Select All ({getFilteredNodes().length})
                </button>
                <button
                  onClick={() => setSelectedNodes([])}
                   className={`px-3 py-1 text-sm rounded transition-all font-instrument whitespace-nowrap min-w-[100px] ${
                  selectedNodes.length > 0
                        ? 'bg-[#5348CB] text-white'
                        : 'bg-gray-200 text-black '
                       }`}
                  disabled={loading || isProcessing}
                >
                  Clear All
                </button>
                <button
                  onClick={handleDeepScan}
                  className="flex items-center justify-center disabled:opacity-80 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#5348CB",
                fontFamily: 'Instrument Sans, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'white',
                minWidth: '102px',
                width: '110px',
                textAlign: 'center',
                borderRadius: '0.375rem', // rounded-md
              }}
                  disabled={loading || isProcessing}
                >
                  Deep Scanning
                </button>
                <div className="relative group inline-block">
                <span className="text-gray-500 hover:text-blue-500 cursor-pointer ml-1">
                  ℹ️
                </span>
                <div className="absolute left-0 top-6 w-72 bg-gray-800 text-white text-xs rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg z-10 pointer-events-none">
                  Deep Scanning may include broken or outdated pages.<br />
                  Please review and choose nodes wisely.
                </div>
            </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Search Pages"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // reset to page 1 on new search
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                  style={{ fontFamily: 'Instrument Sans, sans-serif', width: "140px" }}
                />
                <div className="text-sm text-gray-600">
                  Selected: {selectedNodes.length}
                </div>
              </div>
            </div>

            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Pages to Scrape:
            </h4>
            <div  className="space-y-2 overflow-y-auto border border-gray-200 rounded-md p-4"
                style={{ minHeight: '280px', maxHeight: '384px' }} // max-h-96 = 384px
              >
              {getPaginatedNodes().map((node, index) => (
                <label key={index} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                  value={node}
                  checked={selectedNodes.includes(node)}
                  onChange={() => handleCheckboxChange(node)}
                  className="h-5 w-5 text-blue-600 border-gray-400 rounded shrink-0"
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
            {/* Add Start Scraping button conditionally */}
            {(!isCreateBotFlow) && selectedNodes.length > 0 && !isProcessing &&(
              <div className="mt-4 flex justify-start">
                <button
                  onClick={handleScrape}
                  disabled={loading || isProcessing}
                  className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Scrape Selected Pages
                </button>
              </div>
            )}

          </div>
        )}
       {!isCreateBotFlow && scrapedUrls.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <input
                  value={scrapedSearchTerm}
                  onChange={(e) => setScrapedSearchTerm(e.target.value)}
                  placeholder="Search by title or URL"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700
                            bg-white dark:bg-gray-900 px-10 py-2 text-sm outline-none"
                />
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-70" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={scrapedStatusFilter}
                  onChange={(e) => setScrapedStatusFilter(e.target.value)}
                  className="rounded-md border border-gray-300 dark:border-gray-700
                            bg-white dark:bg-gray-900 px-8 py-2 text-sm"
                >
                  <option value="all">All</option>
                  {Array.from(new Set(scrapedUrls.map(f => (f.status || "").toLowerCase())))
                    .filter(Boolean)
                    .map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                </select>
                <Filter className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
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
                  <tr style={{ backgroundColor: '#EFF0FF' }}>
                    <th
                      className="px-6 py-3 text-left uppercase tracking-wider "
                      style={{
                        fontFamily: 'Instrument Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#333333',
                        textTransform:'none'
                      }}
                    >
                      S.No.
                    </th>
                    <th
                      className="px-6 py-3 text-left uppercase tracking-wider"
                      style={{
                        fontFamily: 'Instrument Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#333333',
                        textTransform:'none'
                      }}
                    >
                      Name
                    </th>
                    <th
                    className="px-6 py-3 text-left uppercase tracking-wider"
                    style={{
                      fontFamily: 'Instrument Sans, sans-serif',
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#333333',
                      textTransform:'none'
                    }}
                  >
                    Status
                  </th>
                    <th
                      className="px-6 py-3 text-left uppercase tracking-wider"
                      style={{
                        fontFamily: 'Instrument Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#333333',
                        textTransform:'none'
                      }}
                    >
                      URL
                    </th>
                    <th
                      className="px-6 py-3 text-left uppercase tracking-wider"
                      style={{
                        fontFamily: 'Instrument Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#333333',
                        textTransform:'none'
                      }}
                    >
                      Words
                    </th>
                    <th
                      className="px-6 py-3 text-left uppercase tracking-wider"
                      style={{
                        fontFamily: 'Instrument Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#333333',
                        textTransform:'none'
                      }}
                    >
                                    Upload Date
                    </th>
                    <th
                      className="px-6 py-3 text-right uppercase tracking-wider"
                      style={{
                        fontFamily: 'Instrument Sans, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#333333',
                        textTransform:'none'
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScrapedUrls && filteredScrapedUrls.length > 0 ? (
                  filteredScrapedUrls.map((item, index) => (
                    <tr
                      key={item.id}
                      className="text-gray-700 dark:text-gray-300"
                    >
                      <td className=" px-4 py-2 text-center">
                      {index + 1}
                    </td>
                      <td className="  px-4 py-2 text-gray-900 dark:text-gray-200 "
                    style={{ fontFamily: 'Instrument Sans, sans-serif',
                      fontSize: '14px',
                       color: '#333333',
                     }}>
                        {item.title || "No Title"}
                      </td>
                      <td
                          className="px-4 py-2 text-gray-900 dark:text-gray-200 relative overflow-visible"
                          style={{
                            fontFamily: 'Instrument Sans, sans-serif',
                            fontSize: '14px',
                            color: '#333333',
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <span>{item.status}</span>

                            {item.status === "Failed" && item.error_code && (
                              <div className="relative group cursor-pointer">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <div
                                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block
                                            bg-white text-xs text-gray-800 border border-gray-300 rounded px-2 py-1
                                            shadow-lg z-50 whitespace-normal break-words w-max max-w-xs"
                                >
                                  {item.error_code}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      <td className="  px-4 py-2 text-gray-900 dark:text-gray-200 "
                    style={{ fontFamily: 'Instrument Sans, sans-serif',
                      fontSize: '14px',
                       color: '#333333',
                     }}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 underline"
                        >
                          {item.url}
                        </a>
                      </td>
                        <td className="  px-4 py-2 text-gray-900 dark:text-gray-200 "
                    style={{ fontFamily: 'Instrument Sans, sans-serif',
                      fontSize: '14px',
                       color: '#333333',
                     }}>
                      {item.wordCount}
                    </td>
                        <td className="  px-4 py-2 text-gray-900 dark:text-gray-200 "
                    style={{ fontFamily: 'Instrument Sans, sans-serif',
                      fontSize: '14px',
                       color: '#333333',
                     }}>
                        {item.upload_date
                          ? new Date(item.upload_date).toLocaleDateString()
                          : "N/A"}
                      </td>

                      <td className=" px-4 py-2 text-center">
                        <button
                          onClick={() => handleDeleteClick(item.url, item.wordCount || 0)}
                          className={`text-red-600 hover:text-red-900 dark:hover:text-red-400 ${
                            (!isReconfiguring && !isCreateBotFlow) ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          disabled={loading || isProcessing || (!isReconfiguring && !isCreateBotFlow)}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        {scrapedSearchTerm !== "" || scrapedStatusFilter !== "all"
                          ? "No websites match your search criteria. Try adjusting your filters."
                          : "No websites found. Add some URLs to get started."
                        }
                      </td>
                    </tr>
                  )}
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