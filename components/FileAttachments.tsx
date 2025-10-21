import React from 'react';
import { XMarkIcon } from './Icons.tsx';

interface FileAttachmentsProps {
  files: File[];
  onRemoveFile: (fileName: string) => void;
}

const FileAttachments: React.FC<FileAttachmentsProps> = ({ files, onRemoveFile }) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 p-3 bg-slate-900/50 rounded-md border border-slate-700 animate-fade-in">
      <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Прикачени файлове:</h4>
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <div 
            key={file.name} 
            className="flex items-center gap-2 bg-slate-700 text-sm pl-3 pr-1.5 py-1 rounded-full animate-slide-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="text-slate-300 max-w-[200px] sm:max-w-xs truncate" title={file.name}>{file.name}</span>
            <button 
              onClick={() => onRemoveFile(file.name)} 
              className="text-slate-400 hover:text-white bg-slate-600 hover:bg-red-500 rounded-full p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-700 focus:ring-red-400"
              aria-label={`Remove ${file.name}`}
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileAttachments;
