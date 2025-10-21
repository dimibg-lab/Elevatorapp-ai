
import { useState, useEffect, useCallback } from 'react';

export interface Message {
  role: 'user' | 'model';
  content: string;
  sources?: { uri: string; title: string }[];
  isLoading?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

export const useChatHistory = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const savedState = localStorage.getItem('chatState');
      if (savedState) {
        const { chats: savedChats, currentChatId: savedChatId } = JSON.parse(savedState);
        if (Array.isArray(savedChats) && savedChats.length > 0 && savedChatId) {
          setChats(savedChats);
          setCurrentChatId(savedChatId);
          return;
        }
      }
    } catch (error) {
      console.error("Failed to load chat history from localStorage", error);
      localStorage.removeItem('chatState');
    }

    // If nothing loaded, create a new chat
    const newChatId = `chat-${Date.now()}`;
    setChats([{ id: newChatId, title: "Нов чат", messages: [] }]);
    setCurrentChatId(newChatId);
  }, []);

  useEffect(() => {
    if (chats.length > 0 && currentChatId) {
      try {
        const stateToSave = JSON.stringify({ chats, currentChatId });
        localStorage.setItem('chatState', stateToSave);
      } catch (error) {
        console.error("Failed to save chat history to localStorage", error);
      }
    } else {
      localStorage.removeItem('chatState');
    }
  }, [chats, currentChatId]);

  const createNewChat = useCallback(() => {
    const newChatId = `chat-${Date.now()}`;
    const newChat: Chat = { id: newChatId, title: "Нов чат", messages: [] };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChatId);
  }, []);

  const deleteChat = useCallback((chatIdToDelete: string) => {
    setChats(prev => {
        const remainingChats = prev.filter(chat => chat.id !== chatIdToDelete);
        
        if (currentChatId === chatIdToDelete) {
            if (remainingChats.length > 0) {
                setCurrentChatId(remainingChats[0].id);
            } else {
                // If the last chat is deleted, create a new one
                const newChatId = `chat-${Date.now()}`;
                setCurrentChatId(newChatId);
                return [{ id: newChatId, title: "Нов чат", messages: [] }];
            }
        }
        return remainingChats;
    });
  }, [currentChatId]);


  const renameChat = useCallback((chatIdToRename: string, newTitle: string) => {
    setChats(prev => prev.map(chat =>
      chat.id === chatIdToRename
        ? { ...chat, title: newTitle.trim() || "Нов чат" }
        : chat
    ));
  }, []);
  
  const currentChat = chats.find(chat => chat.id === currentChatId);

  return {
    chats,
    currentChat,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    deleteChat,
    renameChat,
    setChats,
  };
};
