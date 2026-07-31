interface MessageProps {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  fileUrl?: string;
  fileType?: 'image' | 'video';
  clipPath?: string;
}

const Message = ({ content, isUser, timestamp, fileUrl, fileType, clipPath }: MessageProps) => {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`w-[700px] flex-shrink-0 p-4 rounded-lg ${
          isUser
            ? 'bg-gray-800 border border-gray-700 text-white'
            : 'bg-amber-950 border border-amber-800 text-amber-100'
        }`}
      >
        <div className={`flex items-center gap-2 text-xs mb-2 ${isUser ? 'text-gray-400' : 'text-amber-400'}`}>
          {!isUser && (
            <div className="flex items-center gap-2">
              {/* SmartGuard Status Indicator */}
              <div className="relative">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse shadow-lg shadow-amber-500/50"></div>
                <div className="absolute inset-0 w-3 h-3 bg-amber-400 rounded-full animate-ping opacity-75"></div>
              </div>
              <span>SmartGuard AI</span>
            </div>
          )}
          {isUser && <span>OPERATOR</span>}
        </div>
        
        {fileUrl && (
          <div className="mb-3">
            {fileType === 'image' ? (
              <img 
                src={fileUrl} 
                alt="Uploaded image" 
                className="max-w-full h-auto rounded border border-gray-600"
                style={{ maxHeight: '300px' }}
              />
            ) : fileType === 'video' ? (
              <video 
                src={fileUrl} 
                controls 
                className="max-w-full h-auto rounded border border-gray-600"
                style={{ maxHeight: '300px' }}
              />
            ) : null}
          </div>
        )}
        
        {clipPath && (
          <div className="mb-3">
            <video 
              src={`/media/${clipPath.split('/').pop()}?XTransformPort=8080`}
              controls 
              className="max-w-full h-auto rounded border border-gray-600"
              style={{ maxHeight: '300px' }}
            />
          </div>
        )}
        
        <p className="leading-relaxed break-words">{content}</p>
        <div className="text-xs mt-2 opacity-50">
          {timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default Message;
