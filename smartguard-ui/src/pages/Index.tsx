import { useEffect, useRef, useState } from 'react';
import {
  Camera, Clock, Cpu, Eye, FileVideo, HardDrive, Loader2,
  Maximize2, Pause, Play, Send, Shield, Upload, Video, X, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TypingIndicator from '@/components/TypingIndicator';

interface LogEntry {
  id: string;
  type: 'AI' | 'OPERATOR' | 'SYSTEM';
  content: string;
  timestamp: Date;
  clipPath?: string;
  fileUrl?: string;
  fileType?: 'image' | 'video';
  status?: 'in_progress' | 'completed' | 'failed';
}

interface AttachedFile {
  url: string;
  type: 'image' | 'video';
  file: File;
}

interface UploadedVideo {
  id: string;
  url: string;
  file: File;
  filename: string;
  timestamp: Date;
  videoPath?: string;
  taskId?: string;
  processingStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  sizeBytes?: number;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

const Index = () => {
  const now = useClock();
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'sys-0',
      type: 'SYSTEM',
      content: 'SmartCCTV is online. Upload a video to begin.',
      timestamp: new Date(),
    },
    {
      id: 'sys-1',
      type: 'AI',
      content: 'Hi! I can analyze CCTV footage. Upload a video and ask me to find specific moments, retrieve clips, or describe what is happening.',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<UploadedVideo | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isThinking]);

  useEffect(() => {
    if (!activeVideo && uploadedVideos.length > 0) {
      const ready = uploadedVideos.filter(v => v.processingStatus === 'completed');
      const candidate = ready[ready.length - 1] || uploadedVideos[uploadedVideos.length - 1];
      if (candidate) setActiveVideo(candidate);
    }
  }, [uploadedVideos, activeVideo]);

  useEffect(() => {
    const t = setInterval(() => {
      uploadedVideos.forEach(async (video) => {
        if (video.taskId && video.processingStatus === 'in_progress') {
          try {
            const r = await fetch(`/task-status/${video.taskId}?XTransformPort=8080`);
            if (r.ok) {
              const data = await r.json();
              if (data.status === 'completed' || data.status === 'failed') {
                setUploadedVideos(prev => prev.map(v =>
                  v.id === video.id ? { ...v, processingStatus: data.status } : v
                ));
                setLogs(prev => [...prev, {
                  id: `sys-${Date.now()}-${video.id}`,
                  type: 'SYSTEM',
                  content: data.status === 'completed'
                    ? `"${video.filename}" is ready to search.`
                    : `Indexing failed for "${video.filename}".`,
                  timestamp: new Date(),
                }]);
              }
            }
          } catch (e) { /* noop */ }
        }
      });
    }, 4000);
    return () => clearInterval(t);
  }, [uploadedVideos]);

  const sendMessage = async (userText: string, fileUrl?: string, fileType?: 'image' | 'video') => {
    if (!userText.trim() && !fileUrl) return;
    setInputMessage('');
    setAttachedFile(null);

    const userLog: LogEntry = {
      id: `u-${Date.now()}`,
      type: 'OPERATOR',
      content: userText || (fileType === 'image' ? '[Image attached]' : '[Video attached]'),
      timestamp: new Date(),
      fileUrl, fileType,
    };
    setLogs(prev => [...prev, userLog]);
    setIsThinking(true);

    try {
      const requestBody: { message: string; image_base64?: string; video_path?: string } = { message: userText };

      if (fileUrl && fileType === 'image') {
        const blob = await (await fetch(fileUrl)).blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
        requestBody.image_base64 = base64;
      }

      const videoToUse = activeVideo || uploadedVideos[uploadedVideos.length - 1];
      if (videoToUse?.videoPath) requestBody.video_path = videoToUse.videoPath;

      const r = await fetch('/chat?XTransformPort=8080', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!r.ok) throw new Error(`API ${r.status}`);
      const data = await r.json();
      setLogs(prev => [...prev, {
        id: `a-${Date.now()}`,
        type: 'AI',
        content: data.message,
        timestamp: new Date(),
        clipPath: data.clip_path,
      }]);
    } catch (e) {
      setLogs(prev => [...prev, {
        id: `a-${Date.now()}`,
        type: 'AI',
        content: 'I could not reach the server. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSend = () => {
    const fileUrl = attachedFile?.url;
    const fileType = attachedFile?.type;
    sendMessage(inputMessage, fileUrl, fileType);
  };

  const handleVideoUpload = async (file: File) => {
    setIsProcessingVideo(true);
    setUploadProgress(0);
    setLogs(prev => [...prev, {
      id: `sys-up-${Date.now()}`,
      type: 'SYSTEM',
      content: `Uploading "${file.name}" (${formatBytes(file.size)})...`,
      timestamp: new Date(),
      status: 'in_progress',
    }]);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/upload-video?XTransformPort=8080', { method: 'POST', body: fd });
      if (!up.ok) throw new Error('upload failed');
      const ud = await up.json();
      setUploadProgress(40);

      const pp = await fetch('/process-video?XTransformPort=8080', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_path: ud.video_path }),
      });
      if (!pp.ok) throw new Error('process failed');
      const pd = await pp.json();
      setUploadProgress(85);

      const newVideo: UploadedVideo = {
        id: ud.video_path,
        url: URL.createObjectURL(file),
        file,
        filename: file.name,
        timestamp: new Date(),
        videoPath: ud.video_path,
        taskId: pd.task_id,
        processingStatus: 'in_progress',
        sizeBytes: file.size,
      };
      setUploadedVideos(prev => [...prev, newVideo]);
      setActiveVideo(newVideo);
      setUploadProgress(100);
    } catch (e) {
      setLogs(prev => [...prev, {
        id: `sys-err-${Date.now()}`,
        type: 'SYSTEM',
        content: `Could not upload "${file.name}". ${(e as Error).message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsProcessingVideo(false);
      setTimeout(() => setUploadProgress(0), 500);
    }
  };

  const handleImageAttach = (file: File) => {
    setAttachedFile({ url: URL.createObjectURL(file), type: 'image', file });
  };

  const removeVideo = (id: string) => {
    const v = uploadedVideos.find(v => v.id === id);
    if (v) URL.revokeObjectURL(v.url);
    setUploadedVideos(prev => prev.filter(v => v.id !== id));
    if (activeVideo?.id === id) setActiveVideo(null);
  };

  const togglePlay = () => {
    const v = mainVideoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  };

  const readyCount = uploadedVideos.filter(v => v.processingStatus === 'completed').length;

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight">SmartCCTV</h1>
            <p className="text-xs text-slate-500 leading-tight">AI-powered video incident auditing</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            <span>Groq · Nemotron</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="tabular-nums">{now.toLocaleTimeString()}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] h-[calc(100vh-57px)]">
        {/* Main content */}
        <main className="flex flex-col min-h-0 bg-white">
          {/* Video viewer */}
          <div className="p-4 border-b border-slate-200">
            <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video max-h-[55vh] mx-auto">
              {activeVideo ? (
                <video
                  ref={mainVideoRef}
                  src={activeVideo.url}
                  className="absolute inset-0 w-full h-full"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <Video className="w-16 h-16 mb-3 opacity-50" />
                  <p className="text-sm">No video selected</p>
                  <p className="text-xs mt-1">Upload a video from the right panel</p>
                </div>
              )}

              {/* Top overlay */}
              <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
                <div className="flex items-center gap-2 text-white">
                  {activeVideo && (
                    <span className="flex items-center gap-1.5 text-xs font-medium bg-red-500 px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      REC
                    </span>
                  )}
                  <span className="text-sm font-medium truncate max-w-[300px]">
                    {activeVideo ? activeVideo.filename : 'No feed'}
                  </span>
                </div>
                <span className="text-white text-xs tabular-nums bg-black/40 px-2 py-1 rounded">
                  {now.toLocaleTimeString()}
                </span>
              </div>

              {/* Bottom controls */}
              {activeVideo && (
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={togglePlay}
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 bg-white/90 hover:bg-white text-slate-900"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 bg-white/90 hover:bg-white text-slate-900"
                      onClick={() => mainVideoRef.current?.requestFullscreen?.()}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="text-white text-xs bg-black/40 px-2 py-1 rounded">
                    {activeVideo.processingStatus === 'completed' ? 'Indexed · Ready' : 'Indexing...'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {logs.map((log) => (
                <ChatBubble key={log.id} log={log} />
              ))}
              {isThinking && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-slate-200 p-4 bg-white">
              {attachedFile && (
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-700 bg-slate-100 rounded-lg px-3 py-2 w-fit">
                  <img src={attachedFile.url} className="w-8 h-8 object-cover rounded" />
                  <span className="max-w-[200px] truncate">{attachedFile.file.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-slate-500 hover:text-slate-900"
                    onClick={() => { URL.revokeObjectURL(attachedFile.url); setAttachedFile(null); }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 border-slate-300 text-slate-600 hover:bg-slate-100"
                  onClick={() => imageInputRef.current?.click()}
                >
                  <FileVideo className="w-4 h-4" />
                </Button>
                <Input
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={activeVideo ? `Ask about "${activeVideo.filename}"...` : 'Upload a video, then ask a question...'}
                  className="flex-1 h-10 border-slate-300 focus-visible:ring-blue-500"
                  disabled={isThinking}
                />
                <Button
                  onClick={handleSend}
                  disabled={(!inputMessage.trim() && !attachedFile) || isThinking}
                  className="h-10 px-4 bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-1.5" /> Send
                </Button>
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => e.target.files?.[0] && handleImageAttach(e.target.files[0])}
              />
            </div>
          </div>
        </main>

        {/* Right sidebar — Video library */}
        <aside className="border-l border-slate-200 bg-white flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Video Library</h2>
            <p className="text-xs text-slate-500 mb-3">
              {uploadedVideos.length === 0
                ? 'Upload a video to get started'
                : `${uploadedVideos.length} uploaded · ${readyCount} indexed`}
            </p>
            <Button
              onClick={() => videoInputRef.current?.click()}
              disabled={isProcessingVideo}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700"
            >
              {isProcessingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadProgress > 0 ? `${uploadProgress}%` : 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Video
                </>
              )}
            </Button>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleVideoUpload(f);
                e.target.value = '';
              }}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {uploadedVideos.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No videos yet</p>
                <p className="text-xs mt-1">Click "Upload Video" above</p>
              </div>
            )}
            {uploadedVideos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                isActive={activeVideo?.id === v.id}
                onSelect={() => { setActiveVideo(v); setIsPlaying(true); }}
                onRemove={() => removeVideo(v.id)}
              />
            ))}
          </div>

          {isProcessingVideo && uploadProgress > 0 && (
            <div className="p-3 border-t border-slate-200">
              <div className="text-xs text-slate-600 mb-1.5 flex items-center justify-between">
                <span>Uploading & indexing...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

function ChatBubble({ log }: { log: LogEntry }) {
  if (log.type === 'SYSTEM') {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1 max-w-md text-center">
          {log.content}
        </div>
      </div>
    );
  }

  const isUser = log.type === 'OPERATOR';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-slate-200' : 'bg-blue-100'
      }`}>
        {isUser ? (
          <span className="text-xs font-semibold text-slate-700">You</span>
        ) : (
          <Eye className="w-4 h-4 text-blue-600" />
        )}
      </div>
      <div className={`flex-1 max-w-2xl ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`inline-block rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-slate-100 text-slate-900 rounded-tl-sm'
        }`}>
          {log.fileUrl && log.fileType === 'image' && (
            <img src={log.fileUrl} className="rounded-lg max-h-48 mb-2" />
          )}
          {log.fileUrl && log.fileType === 'video' && (
            <video src={log.fileUrl} controls className="rounded-lg max-h-48 mb-2" />
          )}
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{log.content}</p>
        </div>
        {log.clipPath && (
          <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-w-md">
            <div className="px-3 py-1.5 bg-slate-800 text-white text-xs flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5" />
              Retrieved clip
            </div>
            <video
              src={`/media/${log.clipPath}?XTransformPort=8080`}
              controls
              className="w-full"
            />
          </div>
        )}
        <p className={`text-[10px] text-slate-400 mt-1 ${isUser ? 'text-right' : ''}`}>
          {log.timestamp.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function VideoCard({
  video,
  isActive,
  onSelect,
  onRemove,
}: {
  video: UploadedVideo;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const status = video.processingStatus;
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-lg border cursor-pointer overflow-hidden transition-all ${
        isActive
          ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50/50'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      }`}
    >
      <div className="flex gap-3 p-2.5">
        <div className="relative w-24 aspect-video bg-slate-900 rounded overflow-hidden flex-shrink-0">
          <video src={video.url} className="w-full h-full object-cover" muted />
          {status === 'in_progress' && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{video.filename}</p>
          <p className="text-xs text-slate-500 mt-0.5">{video.timestamp.toLocaleString()}</p>
          <p className="text-xs text-slate-400">{formatBytes(video.sizeBytes)}</p>
          <div className="mt-1.5">
            {status === 'in_progress' && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                <Loader2 className="w-3 h-3 animate-spin" /> Indexing
              </span>
            )}
            {status === 'completed' && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ready
              </span>
            )}
            {status === 'failed' && (
              <span className="inline-flex items-center gap-1 text-xs text-red-700">
                Failed
              </span>
            )}
          </div>
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1.5 right-1.5 h-6 w-6 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default Index;
