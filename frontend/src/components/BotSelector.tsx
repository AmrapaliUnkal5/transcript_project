import React from 'react';
import { Bot as BotIcon, ChevronDown } from 'lucide-react';
import { useBot } from '../context/BotContext';

export const BotSelector = () => {
  const { selectedBot, setSelectedBot, bots } = useBot();

  return (
    <div className="relative inline-block">
      <select
        value={selectedBot?.id || ''}
        onChange={(e) => {
          const bot = bots.find(b => b.id === Number(e.target.value));
          setSelectedBot(bot || null);
        }}
        className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg pl-10 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="">Select a bot</option>
        {bots.map(bot => (
          <option key={bot.id} value={bot.id}>
            {bot.name}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <BotIcon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
};