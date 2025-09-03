import React, { useEffect } from "react";

interface UserUsage {
  globalWordsUsed: number;
  currentSessionWords: number;
  planLimit: number;
  globalStorageUsed: number;
  currentSessionStorage: number;
  storageLimit: number;
}

interface UsageSummaryProps {
  usagePercentage: number;
  totalWordsUsed: number;
  planLimit: number;
  currentSessionWords: number;
  storageUsagePercentage: number;
  totalStorageUsed: number;
  storageLimit: number;
  currentSessionStorage: number;
  formatBytesToHumanReadable: (bytes: number) => string;
  // Add these new props
  globalWordsUsed: number;
  globalStorageUsed: number;
  setUserUsage: React.Dispatch<React.SetStateAction<UserUsage>>;
}

const getUsageBarBg = (pct: number) =>
  pct >= 90 ? "#ef4444" : pct >= 75 ? "#f59e0b" : "linear-gradient(to right, #665AD7, #9D9CFF)";

const UsageSummary: React.FC<UsageSummaryProps> = ({
  usagePercentage,
  totalWordsUsed,
  planLimit,
  currentSessionWords,
  storageUsagePercentage,
  totalStorageUsed,
  storageLimit,
  currentSessionStorage,
  formatBytesToHumanReadable,
  setUserUsage,
}) => {

  // Listen for storage events from other tabs/components
  useEffect(() => {
    const handleStorageUpdate = () => {
      // This would be called when other operations update localStorage
      const updatedUsage = localStorage.getItem('userUsageUpdate');
      if (updatedUsage) {
        const parsedUsage = JSON.parse(updatedUsage);
        setUserUsage(prev => ({
          ...prev,
          globalWordsUsed: parsedUsage.globalWordsUsed,
          globalStorageUsed: parsedUsage.globalStorageUsed
        }));
        localStorage.removeItem('userUsageUpdate');
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    return () => window.removeEventListener('storage', handleStorageUpdate);
  }, [setUserUsage]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      {/* Word Usage */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-700 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-gray-800 dark:text-gray-100 font-semibold">Word Usage</span>
          <span className="text-xs text-gray-500">{Math.round(usagePercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mt-2 dark:bg-gray-600">
          <div
            className="h-3 rounded-full transition-all"
            style={{
              width: `${usagePercentage}%`,
              background: getUsageBarBg(usagePercentage),
            }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {totalWordsUsed.toLocaleString()} / {planLimit.toLocaleString()}
          {currentSessionWords > 0 && (
            <span className="ml-2">(Current Bot: {currentSessionWords.toLocaleString()})</span>
          )}
        </div>
        {usagePercentage >= 100 ? (
          <div className="mt-2 text-xs text-red-500">You've reached your word limit! Remove files or upgrade your plan.</div>
        ) : usagePercentage >= 90 ? (
          <div className="mt-2 text-xs text-red-500">Critical: {Math.round(usagePercentage)}% used</div>
        ) : usagePercentage >= 75 ? (
          <div className="mt-2 text-xs text-yellow-600">Approaching limit: {Math.round(usagePercentage)}% used</div>
        ) : null}
      </div>

      {/* Storage */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:bg-gray-700 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <span className="text-gray-800 dark:text-gray-100 font-semibold">Storage</span>
          <span className="text-xs text-gray-500">{Math.round(storageUsagePercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 mt-2 dark:bg-gray-600">
          <div
            className="h-3 rounded-full transition-all"
            style={{
              width: `${storageUsagePercentage}%`,
              background: getUsageBarBg(storageUsagePercentage),
            }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {formatBytesToHumanReadable(totalStorageUsed)} / {formatBytesToHumanReadable(storageLimit)}
          {currentSessionStorage > 0 && (
            <span className="ml-2">(This session: {formatBytesToHumanReadable(currentSessionStorage)})</span>
          )}
        </div>
        {storageUsagePercentage >= 100 ? (
          <div className="mt-2 text-xs text-red-500">You've reached your storage limit! Remove files or upgrade your plan.</div>
        ) : storageUsagePercentage >= 90 ? (
          <div className="mt-2 text-xs text-red-500">Critical: {Math.round(storageUsagePercentage)}% used</div>
        ) : storageUsagePercentage >= 75 ? (
          <div className="mt-2 text-xs text-yellow-600">Approaching limit: {Math.round(storageUsagePercentage)}% used</div>
        ) : null}
      </div>
    </div>
  );
};

export default UsageSummary;