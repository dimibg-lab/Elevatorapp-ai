

import { useState, useEffect, useCallback } from 'react';

export interface Message {
  id: string;
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
    // 1. Check for a shared chat in the URL hash first
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const encodedData = hash.substring('#share='.length);
        const jsonString = decodeURIComponent(escape(atob(encodedData)));
        const sharedChatData = JSON.parse(jsonString);

        if (sharedChatData.title && Array.isArray(sharedChatData.messages)) {
          const newChatId = `chat-${Date.now()}`;
          const importedChat: Chat = {
            id: newChatId,
            title: `Споделено: ${sharedChatData.title}`,
            messages: sharedChatData.messages.map((msg: Omit<Message, 'id'>, index: number) => ({
              ...msg,
              id: `${msg.role}-${Date.now()}-${index}`, // Re-generate unique IDs
            })),
          };

          let existingChats: Chat[] = [];
          const savedState = localStorage.getItem('chatState');
          if (savedState) {
            const { chats: savedChats } = JSON.parse(savedState);
            if (Array.isArray(savedChats)) {
                existingChats = savedChats;
            }
          }

          const newChats = [importedChat, ...existingChats];
          setChats(newChats);
          setCurrentChatId(newChatId);

          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          return; 
        }
      } catch (error) {
        console.error("Failed to load shared chat from URL", error);
      }
    }
    
    // 2. If no shared chat, load from localStorage
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

    // 3. If nothing loaded, create a new chat
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
    } else if (localStorage.getItem('chatState')) { // Clear storage if all chats are deleted
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