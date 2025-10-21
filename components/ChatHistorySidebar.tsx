
import React, { useState, useEffect, useRef } from 'react';
import { PlusIcon, WrenchIcon, XMarkIcon, TrashIcon, PencilIcon } from './Icons.tsx';

interface Chat {
  id: string;
  title: string;
}

interface ChatHistorySidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
}

const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({ chats, currentChatId, isOpen, onClose, onNewChat, onSelectChat, onDeleteChat, onRenameChat }) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingChatId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingChatId]);

  const handleStartEditing = (chat: Chat) => {
    setEditingChatId(chat.id);
    setEditedTitle(chat.title);
  };

  const handleCancelEditing = () => {
    setEditingChatId(null);
    setEditedTitle('');
  };

  const handleSaveRename = () => {
    if (editingChatId && editedTitle.trim()) {
      onRenameChat(editingChatId, editedTitle.trim());
    }
    handleCancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelEditing();
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
            className="fixed inset-0 bg-black/60 z-30 sm:hidden"
            onClick={onClose}
            aria-hidden="true"
        ></div>
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 flex flex-col p-2 h-full flex-shrink-0 border-r border-slate-800 transition-transform duration-300 ease-in-out sm:relative sm:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between space-x-3 p-2 mb-4">
            <div className="flex items-center space-x-3 overflow-hidden">
                <WrenchIcon className="h-9 w-9 text-sky-400 flex-shrink-0" />
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300 whitespace-nowrap">
                AI Асансьорен Техник
                </h1>
            </div>
            <button
                onClick={onClose}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-800 sm:hidden"
                aria-label="Затвори менюто"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>
        <button
            onClick={onNewChat}
            className="flex items-center justify-center w-full p-2 mb-4 text-sm font-semibold rounded-md bg-sky-600 text-slate-100 hover:bg-sky-500 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
            <PlusIcon className="w-5 h-5 mr-2" />
            Нов чат
        </button>
        <div className="flex-grow overflow-y-auto pr-1">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2">История</h2>
            <nav>
            <ul className="space-y-1">
                {chats.map(chat => (
                <li key={chat.id} className="group relative">
                    {editingChatId === chat.id ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={handleKeyDown}
                        className="w-full text-sm p-2 rounded-md bg-slate-600 text-white outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <>
                        <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); onSelectChat(chat.id); }}
                        className={`block w-full text-left p-2 rounded-md text-sm truncate transition-colors ${
                            currentChatId === chat.id
                            ? 'bg-slate-700/80 text-white font-semibold'
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                        }`}
                        title={chat.title}
                        >
                        {chat.title}
                        </a>
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center bg-slate-700/80 group-hover:bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleStartEditing(chat); }}
                                className="p-1 text-slate-400 hover:text-sky-400"
                                aria-label={`Преименувай чат "${chat.title}"`}
                            >
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                                className="p-1 text-slate-400 hover:text-red-400"
                                aria-label={`Изтрий чат "${chat.title}"`}
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                      </>
                    )}
                </li>
                ))}
            </ul>
            </nav>
        </div>
      </aside>
    </>
  );
};

export default ChatHistorySidebar;
