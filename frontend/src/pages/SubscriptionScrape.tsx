import React, { useState, useEffect } from "react";
//import { Button } from "@/components/ui/button";
//import { Input } from "@/components/ui/input";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
//import { toast } from "react-toastify";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
//import Loader from "../components/Loader";
import { Trash2, Info } from "lucide-react";
import { toast } from "react-toastify";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";

interface SubscriptionScrapeProps {
  isReconfiguring: boolean;
  // Add other props if you have them
}

const SubscriptionScrape: React.FC<SubscriptionScrapeProps> = ({
  isReconfiguring,
}) => {
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
  const [successMessages, setSuccessMessages] = useState<string[]>([]);
  const [isSaved, setIsSaved] = useState(false); // Track save operation
  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  const [scrapedWebsiteOrigins, setScrapedWebsiteOrigins] = useState<string[]>(
    []
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const [scrapedUrls, setScrapedUrls] = useState<
    { id: number; url: string; title: string;upload_date?: string }[]
  >([]);

  const handleScrapingSuccess = (scrapedUrl: string) => {
    if (!successMessages.includes(scrapedUrl)) {
      setSuccessMessages((prevMessages) => [...prevMessages, scrapedUrl]);
    }
  };
  const handleSaveSuccess = () => {
    setIsSaved(true); // Allow messages to show after saving
  };
  const { getPlanById } = useSubscriptionPlans();
  const [searchTerm, setSearchTerm] = useState("");

  // const getWebsiteLimit = (planId: number): number => {
  //   if (planId === 4) return Infinity; // Unlimited
  //   if (planId === 3) return 2;
  //   return 1; // Or 0 for free plans
  // };

  const getWebsiteLimit = (planId: number): number => {
    const plan = getPlanById(planId);

    if (!plan || !plan.website_crawl_limit) return 0;

    const limitStr = plan.website_crawl_limit.toLowerCase();

    if (limitStr.includes("multiple")) return Infinity;

    const match = limitStr.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  };

  // ✅ Move fetchScrapedUrls outside of useEffect so it can be reused
  const fetchScrapedUrls = async () => {
    console.log("user.subscription_plan_id", user.subscription_plan_id);
    console.log("websiteUrl", websiteUrl.length);
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
          upload_date: item.upload_date,
        }));

        console.log("Formatted URLs:", formattedUrls);
        setScrapedUrls(formattedUrls); // ✅ Update state correctly
        // Set the first scraped website URL
        if (formattedUrls.length > 0) {
          const uniqueOrigins = [
            ...new Set(formattedUrls.map((item) => new URL(item.url).origin)),
          ];
          setScrapedWebsiteOrigins(uniqueOrigins);
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

  // Handle delete confirmation
  const handleDeleteClick = (url: string) => {
    setUrlToDelete(url); // Set URL to delete
    setIsModalOpen(true); // Open modal
  };

  // Handle actual delete
  const confirmDelete = async () => {
    if (!urlToDelete || !selectedBot?.id) return;

    try {
      setLoading(true);
      await authApi.deleteScrapedUrl(selectedBot.id, urlToDelete);
      toast.success("URL deleted successfully!");
      fetchScrapedUrls(); // Refresh list
    } catch (error) {
      toast.error("Failed to delete URL.");
      console.error("Delete Error:", error);
    } finally {
      setLoading(false);
      setIsModalOpen(false); // Close modal
      setUrlToDelete(null);
    }
  };

  const handleFetchNodes = async () => {
    setSearchTerm('');
    console.log(
      "getWebsiteLimit(user.subscription_plan_id)",
      getWebsiteLimit(user.subscription_plan_id)
    );
    console.log("scrapedWebsiteUrl.length", scrapedWebsiteOrigins.length);

    if (!websiteUrl) {
      toast.error("Please enter a website URL.");
      return;
    }
     if (!isReconfiguring) {
      toast.error("Please click Reconfigure first before adding website URLs");
      return;
    }

    const currentOrigin = new URL(websiteUrl).origin;

    const isExistingOrigin = scrapedWebsiteOrigins.includes(currentOrigin);
    const websiteLen = getWebsiteLimit(user.subscription_plan_id);
    if (
      scrapedWebsiteOrigins.length >=
        getWebsiteLimit(user.subscription_plan_id) &&
      !isExistingOrigin
    ) {
      toast.error(
        user.subscription_plan_id === 3
          ? `You've reached the limit of ${websiteLen} website scrape${
              websiteLen > 1 ? "s" : ""
            } on your current plan. Upgrade to scrape more.`
          : "You cannot scrape more websites on your current plan."
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
        toast.error("No valid pages found for this website.");
      }
    } catch (error) {
      console.error("Error fetching nodes:", error);
      toast.error(
        "Failed to fetch website pages. Please check the URL and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Updated to use the async version of the scrapeNodes API
  const handleScrape = async () => {
    if (selectedNodes.length === 0) {
      toast.error("Please select at least one page to scrape.");
      return;
    }

    setLoading(true);
    setIsProcessing(true);

    try {
      // Validate bot ID first
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        toast.error("Bot ID is missing. Please select a bot first.");
        setIsProcessing(false);
        setLoading(false);
        return;
      }

      console.log("Starting async scraping for bot ID:", selectedBot.id);
      console.log("Selected nodes:", selectedNodes);

      // Use the async version of scrapeNodes
      const response = await authApi.scrapeNodesAsync(
        selectedNodes,
        selectedBot.id
      );
      console.log("Scraping response:", response);

      toast.info(
        "Your website content is being prepared. You'll receive a notification when it's ready to use."
      );

      localStorage.setItem("isScraped", "1"); // added for createbot.tsx page

      if (websiteUrl) {
        handleScrapingSuccess(websiteUrl);
      }

      handleSaveSuccess(); // Mark save as completed
      setWebsiteUrl(""); // Reset the input textbox
      setSelectedNodes([]); // Clear the checkbox selection
      setNodes([]); // Clear the nodes list

      // We'll fetch scraped URLs after a delay to give the backend time to process
      setTimeout(() => {
        fetchScrapedUrls();
      }, 2000);
    } catch (error) {
      console.error("Error starting web scraping:", error);
      toast.error(
        "An error occurred while starting the scraping process. Please try again."
      );
    } finally {
      setLoading(false);
      // Keep isProcessing true since processing is ongoing in the backend
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
    if (!isReconfiguring) {
      toast.error("Please click Reconfigure first before selecting pages");
      return;
    }
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
  useEffect(() => {
    return () => {
      setSuccessMessages([]); // Clear messages when leaving the page
    };
  }, []);

  return (
    <div className="bg-white  p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
      {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Website
      </h1> */}

      <div className="">
        {/* Show only if save operation was completed */}
        {isSaved && successMessages.length > 0 && (
          <div className="mb-2">
            {successMessages.map((msg, index) => (
              <div key={index} className="text-xs text-green-600">
                ✅ Successfully initiated scraping for {msg}
              </div>
            ))}
          </div>
        )}

        {isProcessing && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-start space-x-2  ">
            <Info size={18} className="text-blue-500 flex-shrink-0 mt-0.5 "  />
            <p className="text-sm text-blue-700">
              Your website content is being prepared. You'll receive a notification when it's ready to use.
            </p>
          </div>
        )}


        <h1
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "20px",
    color: "#333333",
    fontWeight: "bold",
    marginBottom: "20px",
    
    
  }}
>
  Manage Websites
</h1>

        <div className="flex items-center space-x-2 w-4/5  ">
          
          {/* <input
            type="text"
            placeholder="Website URL"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={loading || isProcessing}
          /> */}


          <input
  type="text"
  placeholder="Website URL"
  value={websiteUrl}
  onChange={(e) => setWebsiteUrl(e.target.value)}
  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500  "
  style={{
    fontFamily: 'Instrument Sans, sans-serif',
  }}
  disabled={loading || isProcessing}
/>

          <button
  onClick={handleFetchNodes}
  className="ml-2 flex items-center justify-center disabled:opacity-80 disabled:cursor-not-allowed"
  style={{
    backgroundColor: "#5348CB",
    fontFamily: 'Instrument Sans, sans-serif',
    fontSize: '12px',
    fontWeight: 600,
    color: 'white',
    minWidth: '102px',
    width: '140px',
    height: '40px', 
    textAlign: 'center',
    borderRadius: '0.375rem', // same as rounded-md
  }}
  disabled={!websiteUrl || loading || isProcessing}
>
  Fetch Pages
</button>
        </div>

        {/* <p className="text-xs text-gray-500 mt-1 italic">
          {(() => {
            const limit = getWebsiteLimit(user.subscription_plan_id);
            if (user.subscription_plan_id === 1) {
              return "You can scrape only 1 website with the Free Plan. Enter a URL and click Submit";
            } else if (limit === Infinity) {
              return "You can scrape multiple websites with your current plan. Enter a URL and click Submit";
            } else {
              return `You can scrape up to ${limit} websites with your current plan. Enter a URL and click Submit`;
            }
          })()}
        </p> */}

        <p
  className="text-xs text-gray-500 mt-1 italic mb-5"
  style={{ fontFamily: 'Instrument Sans, sans-serif' }}
>
  {(() => {
    const limit = getWebsiteLimit(user.subscription_plan_id);
    if (user.subscription_plan_id === 1) {
      return "You can scrape only 1 website with the Free Plan. Enter a URL and click Submit";
    } else if (limit === Infinity) {
      return "You can scrape multiple websites with your current plan. Enter a URL and click Submit";
    } else {
      return `You can scrape up to ${limit} websites with your current plan. Enter a URL and click Submit`;
    }
  })()}
</p>

      </div>
      {nodes.length > 0 && !isProcessing && (
        <div className="mt-4">
          <div className="flex flex-wrap md:flex-nowrap justify-between items-center mb-2 gap-y-2">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                const filtered = getFilteredNodes();
                setSelectedNodes(filtered);
              }}
              className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-#5348CB-300 min-w-[120px] transition-all"
              disabled={loading || isProcessing}
            >
              Select All ({getFilteredNodes().length})
                </button>
                <button
                  onClick={() => setSelectedNodes([])}
                  className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  disabled={loading || isProcessing}
                >
                  Clear All
                </button>
                <button
                  onClick={handleDeepScan}
                  className="flex items-center justify-center disabled:opacity-80 bg-gray-200 hover:bg-[#5348CB] disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#5348CB",
                fontFamily: 'Instrument Sans, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                color: 'white',
                minWidth: '102px',
                width: '140px',
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
          <div className="space-y-2">
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
      {/* Scrape Button (Visible Only When Checkboxes Are Displayed) */}
      {selectedNodes.length > 0 && !isProcessing && (
        <div className="flex justify-start mt-6">
          <button
            onClick={handleScrape}
            className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || isProcessing}
          >
            Scrape Selected Pages
          </button>
        </div>
      )}
      {loading ? (
        <p className="text-center text-gray-600">Loading...</p>
      ) : scrapedUrls.length === 0 ? (
        <p className="text-center text-gray-500"></p>
      ) : (
        <div className="bg-white ">
          <div className="pl-0 p-4 ">
            <h2
  style={{
    fontFamily: 'Instrument Sans, sans-serif',
    fontSize: '18px',
    fontWeight: 600,
    color: '#1A1A1A', // equivalent to Tailwind's text-gray-900
  }}
>Scraped websites
</h2>

          </div>
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-md "
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
            <table className="w-full ">
              {/* <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    S.No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead> */}

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
                {scrapedUrls.map((item, index) => (
                  <tr
                    key={item.id}
                    className="text-gray-700 "
                  >
                    <td className=" px-4 py-2 text-center">
                      {index + 1}
                    </td>
                    <td className="  px-4 py-2 text-gray-900 dark:text-gray-200 "
                    style={{ fontFamily: 'Instrument Sans, sans-serif',
                      fontSize: '14px',
                       color: '#333333',
                     }}>
                      
                      {item.title || "No Title"}{" "}
                      {/* ✅ Display Title with Fallback */}
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
                        {item.upload_date
                          ? new Date(item.upload_date).toLocaleDateString()
                          : "N/A"}
                      </td>
                    <td className=" px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteClick(item.url)}
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
      {/* Delete Confirmation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <p className="text-lg font-semibold">
              Are you sure you want to delete this URL?
            </p>
            <p className="text-sm text-gray-500">{urlToDelete}</p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded-md mr-2"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionScrape;
