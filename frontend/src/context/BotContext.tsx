import React, { createContext, useContext, useState } from 'react';

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
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  
  // This would come from your API in a real app
  const bots: Bot[] = [
    {
      id: 1,
      name: 'Support Bot',
      status: 'active',
      conversations: 1289,
      satisfaction: 94,
    },
    {
      id: 2,
      name: 'Sales Assistant',
      status: 'active',
      conversations: 856,
      satisfaction: 89,
    }
  ];

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