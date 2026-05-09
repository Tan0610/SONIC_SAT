"use client";
import { Play, Pause } from "lucide-react";
import { useState, useRef } from "react";

interface ContentItem {
  id: string;
  title: string;
  artist: string;
  duration?: string;
  plays?: string;
  audioUrl?: string;
}

interface ContentListProps {
  title: string;
  items: ContentItem[];
  type: "album" | "single";
}

export default function ContentList({ title, items }: ContentListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlayback = async (item: ContentItem) => {
    if (!item.audioUrl) return;

    if (playingId === item.id) {
      // Pause current playing
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // Play new audio
      if (audioRef.current) {
        audioRef.current.src = item.audioUrl;
        try {
          await audioRef.current.play();
          setPlayingId(item.id);
        } catch (error) {
          console.error('Audio playback failed:', error);
          // Try alternative gateway
          const alternativeUrl = item.audioUrl.replace('ipfs.io', 'gateway.lighthouse.storage');
          audioRef.current.src = alternativeUrl;
          try {
            await audioRef.current.play();
            setPlayingId(item.id);
          } catch (fallbackError) {
            console.error('Fallback audio playback failed:', fallbackError);
            alert('Unable to play audio. The file may still be processing on IPFS.');
          }
        }
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingId(null);
  };

  const handleAudioError = () => {
    console.error('Audio loading error');
    setPlayingId(null);
  };
  return (
    <div className="bg-[var(--card-background)] rounded-xl border border-[var(--border-color)] p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button className="text-orange-500 hover:text-orange-400 text-sm font-medium">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center space-x-4 p-3 rounded-lg hover:bg-white/5 transition-colors group"
          >
            {/* Track Number / Play Button */}
            <button 
              onClick={() => togglePlayback(item)}
              disabled={!item.audioUrl}
              className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm hover:text-white transition-colors disabled:cursor-not-allowed"
            >
              {playingId === item.id ? (
                <Pause className="w-4 h-4 text-orange-500" />
              ) : (
                <>
                  <span className="group-hover:hidden">{String(index + 1).padStart(2, '0')}</span>
                  <Play className={`w-4 h-4 hidden group-hover:block ${item.audioUrl ? 'text-white' : 'text-gray-600'}`} />
                </>
              )}
            </button>

            {/* Album Art Placeholder */}
            <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg flex items-center justify-center">
              <div className="w-6 h-6 bg-white/20 rounded"></div>
            </div>

            {/* Content Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium text-sm truncate">{item.title}</h4>
              <p className="text-gray-300 text-xs truncate font-semibold">{item.artist}</p>
            </div>

            {/* Duration/Stats */}
            <div className="text-gray-400 text-xs">
              {item.duration || item.plays}
            </div>

          </div>
        ))}
      </div>

      
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        preload="metadata"
        crossOrigin="anonymous"
      />
    </div>
  );
}
