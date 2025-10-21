
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { getChatResponse } from './services/geminiService.ts';
import { PaperAirplaneIcon, SpinnerIcon, ExclamationTriangleIcon, UserIcon, RobotIcon, LinkIcon, PaperClipIcon, Bars3Icon } from './components/Icons.tsx';
import FileAttachments from './components/FileAttachments.tsx';
import ChatHistorySidebar from './components/ChatHistorySidebar.tsx';

interface Message {
  role: 'user' | 'model';
  content: string;
  sources?: { uri: string; title: string }[];
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

const App: React.FC = () => {
  const [filesForUpload, setFilesForUpload] = useState<File[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const currentChat = chats.find(chat => chat.id === currentChatId);
  const messages = currentChat?.messages ?? [];

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

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const combined = [...filesForUpload, ...newFiles];
      const uniqueFiles = Array.from(new Map(combined.map(item => [item.name, item])).values());
      setFilesForUpload(uniqueFiles);
      setError('');
    }
  };
  
  const handleRemoveFile = (fileName: string) => {
    setFilesForUpload(prev => prev.filter(file => file.name !== fileName));
  };

  const handleSendMessage = useCallback(async (questionToSend?: string) => {
    const question = questionToSend || currentQuestion;
    if (!question.trim() && filesForUpload.length === 0) return;
    if (!currentChatId) return;

    const userMessageContent = question.trim() || `Анализирай прикачените ${filesForUpload.length} файла.`;
    const userMessage: Message = { role: 'user', content: userMessageContent };
    
    let newTitle = currentChat?.title ?? "Нов чат";
    const isNewChat = currentChat?.messages.length === 0;

    if (isNewChat && question.trim()) {
        newTitle = question.trim().split(' ').slice(0, 5).join(' ');
        if (question.trim().length > newTitle.length) newTitle += '...';
    }

    setChats(prev => prev.map(chat => 
      chat.id === currentChatId 
        ? { ...chat, title: newTitle, messages: [...chat.messages, userMessage] } 
        : chat
    ));
    
    const filesToSend = [...filesForUpload];
    const questionToAsk = question;

    setCurrentQuestion('');
    setFilesForUpload([]);
    setIsLoading(true);
    setError('');

    try {
      const result = await getChatResponse(filesToSend, questionToAsk);
      const modelMessage: Message = { role: 'model', content: result.text, sources: result.sources };
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, modelMessage] } 
          : chat
      ));
    } catch (err) {
      if (err instanceof Error) {
        setError(`Възникна грешка: ${err.message}`);
      } else {
        setError('Възникна неочаквана грешка.');
      }
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: chat.messages.slice(0, -1) } // Remove optimistic user message
          : chat
      ));
      setCurrentQuestion(questionToAsk); // Restore user question
      setFilesForUpload(filesToSend); // Restore files
    } finally {
      setIsLoading(false);
    }
  }, [filesForUpload, currentQuestion, chats, currentChatId]);
  
  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`;
    const newChat: Chat = { id: newChatId, title: "Нов чат", messages: [] };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChatId);
    setCurrentQuestion('');
    setFilesForUpload([]);
    setError('');
  };

  const handleDeleteChat = (chatIdToDelete: string) => {
    const remainingChats = chats.filter(chat => chat.id !== chatIdToDelete);
    
    if (currentChatId === chatIdToDelete) {
        if (remainingChats.length > 0) {
            setCurrentChatId(remainingChats[0].id);
        } else {
            handleNewChat(); // This will create a new chat and set it as current
            return; // Exit early as handleNewChat modifies the chats state
        }
    }
    setChats(remainingChats);
  };

  const isSendDisabled = (!currentQuestion.trim() && filesForUpload.length === 0) || isLoading;

  const exampleQuestions = [
    'Какви са стъпките за диагностика на проблем с вратите, които не се затварят напълно?',
    'Асансьорът пропада леко при спиране на етаж. Какви може да са причините?',
    'Как да разчета код за грешка F-28 на контролер?',
    'Предложи процедура за смяна на носещите въжета.',
  ];

  const handleExampleQuestionClick = (question: string) => {
      setCurrentQuestion(question);
  };

  return (
    <div className="h-screen bg-slate-900 text-slate-200 font-sans flex overflow-hidden">
      <ChatHistorySidebar 
        chats={chats}
        currentChatId={currentChatId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={() => {
          handleNewChat();
          setIsSidebarOpen(false);
        }}
        onSelectChat={(id) => {
          setCurrentChatId(id);
          setIsSidebarOpen(false);
        }}
        onDeleteChat={handleDeleteChat}
      />
      <div className="flex-grow flex flex-col h-screen">
        <div className="w-full max-w-3xl mx-auto flex flex-col h-full p-4 sm:p-6">
          <header className="flex items-center justify-between space-x-4 mb-6 flex-shrink-0">
             <div className="flex items-center gap-4">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-700/50 transition-colors sm:hidden"
                    aria-label="Отвори история на чата"
                >
                    <Bars3Icon className="w-6 h-6" />
                </button>
                <h2 className="text-xl font-semibold text-sky-400">Чат</h2>
             </div>
          </header>

          <main className="flex-grow flex flex-col space-y-4 overflow-hidden">
            <div className="bg-slate-800/50 rounded-lg shadow-lg border border-slate-700 flex-grow flex flex-col overflow-hidden">
              <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto space-y-6">
                {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="flex flex-col items-center mb-8">
                            <RobotIcon className="h-16 w-16 text-sky-600 mb-4" />
                            <h3 className="text-2xl font-semibold text-slate-300">Готов съм да помогна</h3>
                            <p className="text-slate-400 max-w-sm">Прикачете документи (схеми, ръководства) и/или задайте въпрос отдолу.</p>
                        </div>
                        <div className="w-full max-w-lg grid grid-cols-1 md:grid-cols-2 gap-3">
                            {exampleQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleExampleQuestionClick(q)}
                                    className="text-left p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors duration-200 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                    aria-label={`Ask: ${q}`}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, index) => (
                  <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'model' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                        <RobotIcon className="w-5 h-5 text-sky-400" />
                      </div>
                    )}
                    <div className={`max-w-xl p-3.5 rounded-lg shadow ${msg.role === 'user' ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-700/80 rounded-bl-none'}`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-600/50">
                          <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Източници:</h4>
                          <div className="flex flex-col space-y-2">
                            {msg.sources.map((source, i) => (
                              <a
                                key={i}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 transition-colors min-w-0"
                              >
                                <LinkIcon className="w-4 h-4 flex-shrink-0" />
                                <span className="truncate" title={source.title}>{source.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                     {msg.role === 'user' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>
                ))}
                 {isLoading && (
                  <div className="flex items-start gap-3 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                      <RobotIcon className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="max-w-xl p-3.5 rounded-lg shadow bg-slate-700/80 rounded-bl-none flex items-center">
                      <SpinnerIcon className="w-5 h-5 text-slate-300 animate-spin" />
                      <span className="ml-2 text-slate-300">AI мисли...</span>
                    </div>
                  </div>
                )}
              </div>
               {error && (
                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                  <div className="bg-red-900/50 text-red-300 border border-red-800 rounded-lg p-3 flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </main>
          
          <footer className="mt-auto pt-4 flex-shrink-0">
            <div className="relative bg-slate-800/50 rounded-lg shadow-lg border border-slate-700 p-2">
              <FileAttachments files={filesForUpload} onRemoveFile={handleRemoveFile} />
              <div className="flex items-center">
                  <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      id="file-upload"
                      className="hidden"
                  />
                  <label
                      htmlFor="file-upload"
                      className="p-3 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-700/50 transition-colors cursor-pointer"
                      aria-label="Прикачи файлове"
                      title="Прикачи файлове"
                  >
                      <PaperClipIcon className="w-6 h-6" />
                  </label>
                  <textarea
                      value={currentQuestion}
                      onChange={(e) => setCurrentQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isSendDisabled) {
                            handleSendMessage();
                          }
                        }
                      }}
                      placeholder="Задайте въпрос или опишете проблема..."
                      className="w-full h-12 bg-transparent text-slate-200 placeholder-slate-500 resize-none focus:outline-none px-3"
                      rows={1}
                  />
                  <button
                      onClick={() => handleSendMessage()}
                      disabled={isSendDisabled}
                      className="p-3 rounded-md text-slate-200 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:text-slate-400 transition-colors disabled:cursor-not-allowed flex-shrink-0"
                      aria-label="Изпрати"
                  >
                      <PaperAirplaneIcon className="w-6 h-6" />
                  </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default App;
