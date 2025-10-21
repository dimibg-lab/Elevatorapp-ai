

import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getChatResponseStream } from './services/geminiService.ts';
import { PaperAirplaneIcon, SpinnerIcon, ExclamationTriangleIcon, UserIcon, RobotIcon, LinkIcon, PaperClipIcon, Bars3Icon, MicrophoneIcon } from './components/Icons.tsx';
import FileAttachments from './components/FileAttachments.tsx';
import ChatHistorySidebar from './components/ChatHistorySidebar.tsx';
import { useChatHistory, Message, Chat } from './hooks/useChatHistory.ts';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.ts';

const App: React.FC = () => {
  const [filesForUpload, setFilesForUpload] = useState<File[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [appError, setAppError] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    chats,
    currentChat,
    currentChatId,
    setCurrentChatId,
    createNewChat,
    deleteChat,
    renameChat,
    setChats,
  } = useChatHistory();

  const handleTranscript = useCallback((transcript: string) => {
      setCurrentQuestion(prev => prev.trim() + (prev.trim() ? ' ' : '') + transcript);
  }, []);

  const { isListening, error: speechError, toggleListening, isSupported: speechIsSupported } = useSpeechRecognition({
      onTranscript: handleTranscript,
  });

  useEffect(() => {
    if (speechError) {
      setAppError(speechError);
    }
  }, [speechError]);
  
  const messages = currentChat?.messages ?? [];

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto'; // Reset height to recalculate
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // Max height for textarea in pixels
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [currentQuestion]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const combined = [...filesForUpload, ...newFiles];
      const uniqueFiles = Array.from(new Map(combined.map(item => [item.name, item])).values());
      setFilesForUpload(uniqueFiles);
      setAppError('');
    }
  };
  
  const handleRemoveFile = (fileName: string) => {
    setFilesForUpload(prev => prev.filter(file => file.name !== fileName));
  };

  const handleSendMessage = useCallback(async (questionToSend?: string) => {
    const question = questionToSend || currentQuestion;
    if (!question.trim() && filesForUpload.length === 0) return;
    if (!currentChatId) return;

    if (isListening) {
      toggleListening();
    }

    const userMessageContent = question.trim() || `Анализирай прикачените ${filesForUpload.length} файла.`;
    const userMessage: Message = { role: 'user', content: userMessageContent };
    
    const filesToSend = [...filesForUpload];
    const questionToAsk = question;

    // Use functional updates to avoid dependency on 'chats' or 'currentChat'
    setChats(prev => {
        const chatToUpdate = prev.find(c => c.id === currentChatId);
        if (!chatToUpdate) return prev;

        const isNewChat = chatToUpdate.messages.length === 0;
        let newTitle = chatToUpdate.title;
        if (isNewChat && question.trim()) {
            newTitle = question.trim().split(' ').slice(0, 5).join(' ');
            if (question.trim().length > newTitle.length) newTitle += '...';
        }

        return prev.map(chat => 
          chat.id === currentChatId 
            ? { ...chat, title: newTitle, messages: [...chat.messages, userMessage] } 
            : chat
        );
    });
    
    setCurrentQuestion('');
    setFilesForUpload([]);
    setIsLoading(true);
    setAppError('');

    const modelMessagePlaceholder: Message = { role: 'model', content: '', sources: [], isLoading: true };
    setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: [...chat.messages, modelMessagePlaceholder] } 
          : chat
      ));
    
    textareaRef.current?.focus();

    try {
      const stream = getChatResponseStream(filesToSend, questionToAsk);
      let finalSources: { uri: string; title: string }[] = [];

      for await (const chunk of stream) {
        if (chunk.textChunk) {
          setChats(prev => prev.map(chat => {
            if (chat.id !== currentChatId) return chat;
            const updatedMessages = [...chat.messages];
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (lastMessage && lastMessage.role === 'model') {
                lastMessage.content += chunk.textChunk;
            }
            return { ...chat, messages: updatedMessages };
          }));
        }
        if (chunk.isFinal && chunk.sources) {
          finalSources = chunk.sources;
        }
      }
      
      setChats(prev => prev.map(chat => {
        if (chat.id !== currentChatId) return chat;
        const updatedMessages = [...chat.messages];
        const lastMessage = updatedMessages[updatedMessages.length - 1];
        if (lastMessage && lastMessage.role === 'model') {
            lastMessage.isLoading = false;
            lastMessage.sources = finalSources;
        }
        return { ...chat, messages: updatedMessages };
      }));

    } catch (err) {
      if (err instanceof Error) {
        setAppError(`Възникна грешка: ${err.message}`);
      } else {
        setAppError('Възникна неочаквана грешка.');
      }
      setChats(prev => prev.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, messages: chat.messages.slice(0, -2) } 
          : chat
      ));
      setCurrentQuestion(questionToAsk);
      setFilesForUpload(filesToSend);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatId, currentQuestion, filesForUpload, isListening, setChats, toggleListening]);
  
  const handleNewChat = () => {
    createNewChat();
    setCurrentQuestion('');
    setFilesForUpload([]);
    setAppError('');
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
      textareaRef.current?.focus();
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
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
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
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center ${msg.isLoading ? 'animate-pulse' : ''}`}>
                        <RobotIcon className="w-5 h-5 text-sky-400" />
                      </div>
                    )}
                    <div className={`max-w-xl p-3.5 rounded-lg shadow ${msg.role === 'user' ? 'bg-sky-600 text-white rounded-br-none' : 'bg-slate-700/80 rounded-bl-none'}`}>
                      {msg.role === 'model' ? (
                        <>
                          {msg.isLoading && !msg.content && (
                            <div className="flex items-center">
                              <SpinnerIcon className="w-5 h-5 text-slate-300 animate-spin" />
                              <span className="ml-2 text-slate-300">AI мисли...</span>
                            </div>
                          )}
                          {msg.content && (
                             <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              className="prose prose-sm prose-slate prose-invert max-w-none 
                                prose-p:leading-relaxed prose-p:text-slate-300 
                                prose-headings:text-slate-100 prose-headings:font-semibold 
                                prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-6 
                                prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-5 prose-h2:pb-2 prose-h2:border-b prose-h2:border-slate-700 
                                prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4 
                                prose-a:text-sky-400 prose-a:font-medium prose-a:no-underline hover:prose-a:underline 
                                prose-ul:list-disc prose-ul:pl-5 prose-ul:my-3 
                                prose-ol:list-decimal prose-ol:pl-5 prose-ol:my-3 
                                prose-li:my-1.5 prose-li:marker:text-slate-500 
                                prose-blockquote:not-italic prose-blockquote:pl-4 prose-blockquote:border-l-4 prose-blockquote:border-yellow-500 prose-blockquote:bg-yellow-900/20 prose-blockquote:text-yellow-200 prose-blockquote:my-4 prose-blockquote:rounded-r-md 
                                prose-code:bg-slate-800 prose-code:rounded prose-code:px-1.5 prose-code:py-1 prose-code:text-sky-300 prose-code:font-mono prose-code:text-xs prose-code:before:content-[''] prose-code:after:content-[''] 
                                prose-pre:bg-slate-800 prose-pre:p-3 prose-pre:rounded-md prose-pre:border prose-pre:border-slate-700 
                                prose-strong:text-slate-100 
                                prose-hr:border-slate-700 prose-hr:my-6 
                                prose-table:w-full prose-table:my-4 prose-table:border-collapse 
                                prose-thead:border-b prose-thead:border-slate-600 
                                prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-slate-200 
                                prose-tbody:divide-y prose-tbody:divide-slate-700 
                                prose-tr:border-b prose-tr:border-slate-700 
                                prose-td:px-4 prose-td:py-2"
                            >
                              {msg.content + (msg.isLoading ? '▍' : '')}
                            </ReactMarkdown>
                          )}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      {msg.sources && msg.sources.length > 0 && !msg.isLoading && (
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
              </div>
               {appError && (
                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                  <div className="bg-red-900/50 text-red-300 border border-red-800 rounded-lg p-3 flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{appError}</p>
                  </div>
                </div>
              )}
            </div>
          </main>
          
          <footer className="mt-auto pt-4 flex-shrink-0">
            <div className="relative bg-slate-800/50 rounded-lg shadow-lg border border-slate-700 p-2">
              <FileAttachments files={filesForUpload} onRemoveFile={handleRemoveFile} />
              <div className="flex items-start">
                  <label
                      htmlFor="file-upload"
                      className="p-3 rounded-md text-slate-400 hover:text-sky-400 hover:bg-slate-700/50 transition-colors cursor-pointer"
                      aria-label="Прикачи файлове"
                      title="Прикачи файлове"
                  >
                      <PaperClipIcon className="w-6 h-6" />
                  </label>
                  <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      id="file-upload"
                      className="hidden"
                  />
                  {speechIsSupported && (
                    <button
                      onClick={toggleListening}
                      className={`p-3 rounded-md transition-colors ${isListening ? 'text-red-500 hover:bg-red-900/50' : 'text-slate-400 hover:text-sky-400 hover:bg-slate-700/50'}`}
                      aria-label={isListening ? 'Спри гласовото въвеждане' : 'Започни гласово въвеждане'}
                      title={isListening ? 'Спри гласовото въвеждане' : 'Гласово въвеждане'}
                    >
                      <MicrophoneIcon className="w-6 h-6" />
                    </button>
                  )}
                  <textarea
                      ref={textareaRef}
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
                      className="w-full bg-transparent text-slate-200 placeholder-slate-500 resize-none focus:outline-none px-3 py-3 leading-tight"
                      rows={1}
                  />
                  <button
                      onClick={() => handleSendMessage()}
                      disabled={isSendDisabled}
                      className="p-3 self-end rounded-md text-slate-200 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:text-slate-400 transition-colors disabled:cursor-not-allowed flex-shrink-0"
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