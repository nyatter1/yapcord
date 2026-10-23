import React, { useState, useRef, useEffect } from 'react';
import { User, ZoomIn, Reply, Trash2, Smile } from 'lucide-react';
import { ChatMessage } from '../lib/database';
import { EmojiPicker } from './EmojiPicker';

interface ChatMessageItemProps {
  msg: ChatMessage;
  currentUsername: string;
  location: 'channel' | 'dm' | 'self';
  onReply: (msg: ChatMessage) => void;
  onDelete: (msg: ChatMessage) => void;
  onToggleReaction: (msg: ChatMessage, emoji: string) => void;
  onImageClick: (url: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  msg,
  currentUsername,
  onReply,
  onDelete,
  onToggleReaction,
  onImageClick
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isAuthor = msg.authorUsername.toLowerCase() === currentUsername.toLowerCase();

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  return (
    <div className="group relative flex flex-col py-1.5 px-3 -mx-3 hover:bg-[#18191c]/70 rounded-[4px] transition-colors">
      {/* Discord-style Curved Inline Reply line with Author Avatar + Name + Snippet */}
      {msg.replyTo && (
        <div className="flex items-center gap-2 text-[12px] text-[#949ba4] ml-5 mb-1 select-none">
          {/* Curved line connection */}
          <div className="w-6 h-3 border-l-2 border-t-2 border-[#4e5058] rounded-tl-md -mt-1 ml-1 flex-shrink-0" />

          {/* Mini Author Avatar in quoted line */}
          <div className="w-4 h-4 rounded-full bg-[#2b2d31] overflow-hidden flex items-center justify-center flex-shrink-0">
            {msg.replyTo.authorAvatar ? (
              <img src={msg.replyTo.authorAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-2.5 h-2.5 text-[#ff6b00]" />
            )}
          </div>

          {/* Quoted author name */}
          <span className="font-semibold text-white/90 hover:underline cursor-pointer truncate max-w-[140px]">
            @{msg.replyTo.authorDisplayName || msg.replyTo.authorUsername}
          </span>

          {/* Quoted text preview */}
          <span className="text-[#949ba4] truncate max-w-md text-[12px]">
            {msg.replyTo.text ? (
              msg.replyTo.text
            ) : msg.replyTo.imageUrl ? (
              '📷 [Image attachment]'
            ) : (
              '...'
            )}
          </span>
        </div>
      )}

      {/* Main message row */}
      <div className="flex gap-3.5 min-w-0">
        {/* Author Avatar */}
        <div className="w-10 h-10 rounded-full bg-[#18191c] overflow-hidden flex items-center justify-center text-white flex-shrink-0 mt-0.5 ring-2 ring-[#232428]">
          {msg.authorAvatar ? (
            <img src={msg.authorAvatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-[#ff6b00]" />
          )}
        </div>

        {/* Content column */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-white text-[15px] hover:underline cursor-pointer">
              {msg.authorDisplayName || msg.authorUsername || 'Member'}
            </span>
            <span className="text-[11px] text-[#949ba4]">
              {msg.timestamp}
            </span>
          </div>

          {/* Text body */}
          {msg.text && (
            <p className="text-[15px] text-[#dbdee1] leading-relaxed break-words whitespace-pre-wrap select-text mt-0.5">
              {msg.text}
            </p>
          )}

          {/* Image or GIF Attachment */}
          {msg.imageUrl && (
            <div className="mt-2 inline-block max-w-md rounded-[8px] overflow-hidden border border-[#232428] bg-[#111214] group/img relative">
              <img
                src={msg.imageUrl}
                alt="Attachment"
                onClick={() => onImageClick(msg.imageUrl!)}
                className="max-h-80 w-auto max-w-full object-contain cursor-pointer hover:opacity-95 transition-opacity rounded-[8px]"
                loading="lazy"
              />
              <div
                onClick={() => onImageClick(msg.imageUrl!)}
                className="absolute bottom-2 right-2 px-2 py-1 rounded-[4px] bg-black/70 text-white text-[11px] font-medium backdrop-blur-xs opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer flex items-center gap-1 shadow-md"
              >
                <ZoomIn className="w-3.5 h-3.5 text-[#ff6b00]" /> Click to view
              </div>
            </div>
          )}

          {/* Emoji Reactions chips */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {Object.entries(msg.reactions).map(([emoji, users]) => {
                const hasReacted = users.some(
                  (u) => u.toLowerCase() === currentUsername.toLowerCase()
                );
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction(msg, emoji)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[12px] border transition-all cursor-pointer ${
                      hasReacted
                        ? 'bg-[#ff6b00]/15 border-[#ff6b00] text-[#ff8f3d]'
                        : 'bg-[#2b2d31]/60 border-[#35373c] hover:bg-[#35373c] text-[#dbdee1]'
                    }`}
                    title={`${users.join(', ')} reacted with ${emoji}`}
                  >
                    <span>{emoji}</span>
                    <span className="font-bold text-[11px]">{users.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Hover Action Bar without preset reactions */}
      <div className="opacity-0 group-hover:opacity-100 absolute -top-3.5 right-4 bg-[#2b2d31] border border-[#35373c] rounded-[4px] shadow-lg flex items-center px-1.5 py-1 gap-1 z-20 transition-opacity">
        {/* Full Emoji Picker Trigger Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`p-1 hover:bg-[#35373c] rounded-[3px] transition-colors cursor-pointer ${
            showEmojiPicker ? 'text-[#ff6b00] bg-[#35373c]' : 'text-[#949ba4] hover:text-white'
          }`}
          title="Add Reaction"
        >
          <Smile className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-3.5 bg-[#3b3e45] mx-0.5" />

        {/* Reply button */}
        <button
          type="button"
          onClick={() => onReply(msg)}
          className="p-1 text-[#949ba4] hover:text-white hover:bg-[#35373c] rounded-[3px] transition-colors cursor-pointer"
          title="Reply"
        >
          <Reply className="w-4 h-4" />
        </button>

        {/* Delete own message button */}
        {isAuthor && (
          <button
            type="button"
            onClick={() => onDelete(msg)}
            className="p-1 text-[#949ba4] hover:text-[#f23f43] hover:bg-[#35373c] rounded-[3px] transition-colors cursor-pointer"
            title="Delete Message"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Popover Emoji Picker */}
      {showEmojiPicker && (
        <div ref={pickerRef} className="absolute right-4 top-6 z-50 shadow-2xl">
          <EmojiPicker
            onSelectEmoji={(emoji) => {
              onToggleReaction(msg, emoji);
              setShowEmojiPicker(false);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}
    </div>
  );
};
