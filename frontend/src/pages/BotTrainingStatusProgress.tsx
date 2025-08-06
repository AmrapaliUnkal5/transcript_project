import React from "react";
import { BotTrainingStatus } from "../services/api";
import { useBotStatusWebSocket } from '../services/useBotStatusWebSocket';

interface BotTrainingStatusProgressProps {
  status: BotTrainingStatus | null;
  selectedBot: any;
  isConnected: boolean;
  refreshStatus: () => void;
}

export const BotTrainingStatusProgress: React.FC<BotTrainingStatusProgressProps> = ({
  status,
  selectedBot,
  isConnected,
  refreshStatus
}) => {
  if (!status) {
    return (
      <div className="flex items-center justify-center p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl">
        <div className="text-gray-500 flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-400 rounded-full animate-pulse"></div>
          <span>Loading status...</span>
        </div>
      </div>
    );
  }

  const totals = {
    completed: status.progress.files.completed +
      status.progress.websites.completed +
      status.progress.youtube.completed,
    failed: status.progress.files.failed +
      status.progress.websites.failed +
      status.progress.youtube.failed,
    pending: status.progress.files.pending +
      status.progress.websites.pending +
      status.progress.youtube.pending,
    total: status.progress.files.total +
      status.progress.websites.total +
      status.progress.youtube.total
  };

  // Calculate percentages
  const percentages = {
    completed: totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0,
    failed: totals.total > 0 ? Math.round((totals.failed / totals.total) * 100) : 0,
    pending: totals.total > 0 ? Math.round((totals.pending / totals.total) * 100) : 0
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'error': return 'from-red-500 to-red-600';
      case 'training': return 'from-yellow-500 to-orange-500';
      case 'reconfiguring': return 'from-purple-500 to-indigo-500';
      case 'pending': return 'from-blue-500 to-cyan-500';
      case 'retraining': return 'from-indigo-500 to-purple-500';
      default: return 'from-green-500 to-emerald-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'reconfiguring': return 'Reconfiguring...';
      case 'pending': return 'Pending...';
      case 'retraining': return 'Retraining...';
      case 'training': return 'Training...';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getProgressColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'Error': return '#e41515ff';
      case 'training': return '#8b5cf6';
      case 'reconfiguring': return '#d1d5db';
      case 'pending': return '#3b82f6';
      default: return '#22c55e';
    }
  };

  const overallProgress = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-6 border border-white/20 bg-gradient-to-br from-white to-gray-50">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-4">
          {/* Bot Icon */}
          <div className="relative w-12 h-12">
            <img
              src={selectedBot?.bot_icon && selectedBot.bot_icon.trim() !== "" 
                ? selectedBot.bot_icon 
                : "/images/bot_1.png"}
              alt="Bot"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = "/images/bot_1.png";
              }}
              className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-800">
            {selectedBot?.name || "Untitled Bot"}
          </h3>
        </div>
      </div>

      {/* Overall Status Card */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-6 border border-gray-200/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">



            {/* Blinking Status Dot */}
            <div className={`w-3 h-3 rounded-full shadow-md bg-gradient-to-r isConnected ? 'text-green-600' : 'text-yellow-600'
            }`}>
                <div className={`w-3 h-3 rounded-full mr-2 transition-all duration-300 ${
                isConnected
                    ? 'bg-gradient-to-r from-green-400 to-green-600 animate-pulse'
                    : 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                }`} /> 
            </div>

            {/* Label */}
            <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Overall Status:</span>

            {/* Status Text */}
            
            <span className={`
            text-xs font-semibold px-3 py-1 rounded-full shadow-sm border 
            ${status.overall_status === 'Error' ? 'bg-red-100 text-red-700 border-red-300' :
                status.overall_status === 'Training' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                status.overall_status === 'reconfiguring' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                status.overall_status === 'Pending' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                status.overall_status === 'Retraining' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
                'bg-green-100 text-green-700 border-green-300'}
            `}>
            {getStatusText(status.overall_status)}
            </span>

          </div>

          {/* Progress Line + Count */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Progress:</span>
            <span className="text-sm font-bold text-gray-800">{totals.completed}/{totals.total}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
            <div className="h-3 flex relative">
              <div
                className="h-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{
                  width: `${percentages.completed}%`,
                  background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 50%, #15803d 100%)'
                }}
                title={`${percentages.completed}% completed`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-pulse" />
              </div>
              <div
                className="h-full transition-all duration-1000 ease-out"
                style={{
                  width: `${percentages.failed}%`,
                  background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 50%, #b91c1c 100%)'
                }}
                title={`${percentages.failed}% failed`}
              />
              <div
                className="h-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{
                  width: `${percentages.pending}%`,
                  backgroundColor: '#f59e0b'
                }}
                title={`${percentages.pending}% pending`}
              >
                {status.overall_status === 'reconfiguring' && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-pulse" />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-2 text-sm font-medium text-gray-600 space-x-4">
        <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            <span>{percentages.completed}% Completed</span>
        </div>
        <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>{percentages.failed}% Failed</span>
        </div>
        <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
            <span>{percentages.pending}% Pending</span>
        </div>
        </div>
        </div>
      </div>

      {/* Enhanced Progress Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['files', 'websites', 'youtube'] as const).map((type) => {
          const progress = status.progress[type];
          const percentage = Math.round((progress.completed / (progress.total || 1)) * 100);
          const isAllFailed = progress.failed === progress.total && progress.total > 0;
          const isAnyFailed = progress.failed > 0 && !isAllFailed;
          const isTraining = progress.status?.toLowerCase() === 'training';
          const isPending= progress.status?.toLowerCase()=='pending'
          const isReconfiguring= status.overall_status=='reconfiguring'

          return (
            //upper line of donut tile
          //   <div key={type} className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 shadow-sm border border-gray-200/50 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden text-xs ">
           <div
            key={type}
            className={`
            bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 shadow-sm
            ${isTraining ? 'border-4 border-blue-500' : 'border border-gray-200/50'}
            hover:shadow-md transition-all duration-300 transform hover:-translate-y-1
            relative overflow-hidden text-xs
            `}>




          {isTraining && (
           <div className="absolute inset-0 flex items-center justify-center z-10">
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
            <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
            </svg>
            </div>
            )}








          <div
            className={`
             absolute right-2 w-10 h-10 z-20
             ${isReconfiguring ? 'top-3' : 'top-3'}
             `}
                  >
            <div className="relative w-full h-full">
             <svg className="w-full h-full transform -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke={getProgressColor(progress.status)}
                strokeWidth="6"
                strokeDasharray={`${percentage * 1.759} 175.9`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                 />
               </svg>
            <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-[10px] font-bold text-gray-700">{percentage}%</span>
            </div>
          </div>
        </div>


              
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isAllFailed ? 'from-red-500 to-red-700': 
              isTraining ? 'from-blue-400 to-blue-500':
              isReconfiguring ? 'from-gray-100 to-gray-200' :
              isPending ? 'from-gray-300 to-gray-400 ': //from-blue-500 to-cyan-500 
              isAnyFailed ? 'from-amber-400 to-amber-500':
               'from-green-400 to-green-600'
                }`} />



              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-700 uppercase tracking-wide">
                  {type === 'youtube' ? 'YouTube' : type}
                </span>
                <div />
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="text-xl font-bold text-gray-800">{progress.completed}/{progress.total}</div>
                {/* <div className="text-sm font-semibold text-gray-600">{percentage}%</div> */}
              </div>

                <div className="flex items-center justify-between mb-1" style={{ minHeight: '1rem' }}>
                {progress.failed > 0 ? (
                    <span className="text-xs text-red-600 font-medium">Failed: {progress.failed}</span>
                ) : (
                    <span className="text-xs text-transparent font-medium">placeholder</span>
                )}
                </div>


              {/* <div className="flex justify-center mb-2">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                    <circle cx="32" cy="32" r="28" fill="none" stroke={getProgressColor(progress.status)} strokeWidth="6" strokeDasharray={`${percentage * 1.759} 175.9`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-700">{percentage}%</span>
                  </div>
                </div>
              </div> */}

             <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-2 shadow-inner">

            <div
                className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{
                width: `${percentage}%`,
                backgroundColor: getProgressColor(progress.status)
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-pulse" />
            </div>
            </div>

            </div>
          );
        })}
      </div>

      {/* Enhanced Loading Animation */}
      {status.overall_status === 'training' && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-yellow-50 to-orange-50 px-3 py-1 rounded-full border border-yellow-200">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '-0.32s' }} />
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '-0.16s' }} />
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" />
            </div>
            <span className="text-xs font-medium text-yellow-700">
              Training in progress. This page will update automatically.
            </span>
          </div>
        </div>
      )}

      {status.overall_status === 'reconfiguring' && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-50 to-indigo-50 px-3 py-1 rounded-full border border-purple-200">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '-0.32s' }} />
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '-0.16s' }} />
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
            </div>
            <span className="text-xs font-medium text-purple-700">
              Reconfiguring system...
            </span>
          </div>
          <div className="text-xs font-medium text-purple-600 mt-2">
      Click <span className="font-semibold">‘Retrain’</span> to process your upload
    </div>
        </div>
      )}
    </div>
  );
};