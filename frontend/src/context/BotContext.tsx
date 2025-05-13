import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Bot {
  id: number;
  name: string;
  status: string;
  conversations: number;
  satisfaction: number;
}

interface BotContextType {
  selectedBot: Bot | null;
  setSelectedBot: (bot: Bot | null) => void;
  bots: Bot[];
}

const BotContext = createContext<BotContextType | undefined>(undefined);

export const BotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedBot, setSelectedBotState] = useState<Bot | null>(null);


  // Load from localStorage on initial render
  useEffect(() => {
    const savedBot = localStorage.getItem('selectedBot');
    if (savedBot) {
      try {
        setSelectedBotState(JSON.parse(savedBot));
      } catch (e) {
        console.error('Failed to parse saved bot', e);
        localStorage.removeItem('selectedBot');
      }
    }
  }, []);

  // Wrapper function to handle localStorage
  const setSelectedBot = (bot: Bot | null) => {
    if (bot) {
      localStorage.setItem('selectedBot', JSON.stringify(bot));
    } else {
      localStorage.removeItem('selectedBot');
    }
    setSelectedBotState(bot);
  };


  // This would come from your API in a real app
  const bots: Bot[] = [];

  return (
    <BotContext.Provider value={{ selectedBot, setSelectedBot, bots }}>
      {children}
    </BotContext.Provider>
  );
};

export const useBot = () => {
  const context = useContext(BotContext);
  if (context === undefined) {
    throw new Error('useBot must be used within a BotProvider');
  }
  return context;
};