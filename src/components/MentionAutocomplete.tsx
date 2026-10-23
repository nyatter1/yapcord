import React, { useEffect, useRef } from 'react';
import { User, Volume2, Users } from 'lucide-react';

export interface MentionCandidate {
  id: string;
  type: 'everyone' | 'user';
  username: string;
  displayName: string;
  avatar?: string | null;
  status?: string;
  description?: string;
}

interface MentionAutocompleteProps {
  candidates: MentionCandidate[];
  selectedIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
}

export const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  candidates,
  selectedIndex,
  onSelect
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll selected item into view smoothly
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!candidates || candidates.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 w-80 max-w-[calc(100vw-40px)] bg-[#111214] border border-[#232428] rounded-[8px] shadow-2xl p-1.5 z-50 overflow-hidden flex flex-col max-h-64 select-none animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2.5 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider flex items-center justify-between">
        <span>Members Matching</span>
        <span className="text-[10px] text-[#80848e] font-normal">TAB or ↵ to select</span>
      </div>

      <div className="overflow-y-auto space-y-0.5 custom-scrollbar">
        {candidates.map((candidate, idx) => {
          const isSelected = idx === selectedIndex;

          if (candidate.type === 'everyone') {
            return (
              <div
                key="everyone"
                data-selected={isSelected ? 'true' : 'false'}
                onClick={() => onSelect(candidate)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[5px] cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#ff6b00] text-white'
                    : 'text-[#dbdee1] hover:bg-[#232428]'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[13px] ${
                    isSelected ? 'bg-white text-[#ff6b00]' : 'bg-[#ff6b00]/20 text-[#ff8f3d]'
                  }`}
                >
                  @
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[14px] leading-tight">@everyone</span>
                  </div>
                  <p
                    className={`text-[11px] truncate leading-tight mt-0.5 ${
                      isSelected ? 'text-white/80' : 'text-[#949ba4]'
                    }`}
                  >
                    Notify everyone in this server
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={candidate.id}
              data-selected={isSelected ? 'true' : 'false'}
              onClick={() => onSelect(candidate)}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[5px] cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-[#ff6b00] text-white'
                  : 'text-[#dbdee1] hover:bg-[#232428]'
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-[#18191c] overflow-hidden flex items-center justify-center ring-1 ring-[#232428]">
                  {candidate.avatar ? (
                    <img src={candidate.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-[#ff6b00]" />
                  )}
                </div>
                {candidate.status && (
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#111214] ${
                      candidate.status === 'online'
                        ? 'bg-[#23a55a]'
                        : candidate.status === 'idle'
                        ? 'bg-[#f0b232]'
                        : candidate.status === 'dnd'
                        ? 'bg-[#f23f43]'
                        : 'bg-[#80848e]'
                    }`}
                  />
                )}
              </div>

              {/* Names */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-[14px] leading-tight truncate">
                    {candidate.displayName}
                  </span>
                  <span
                    className={`text-[12px] truncate ${
                      isSelected ? 'text-white/80' : 'text-[#949ba4]'
                    }`}
                  >
                    @{candidate.username}
                  </span>
                </div>
                {candidate.description && (
                  <p
                    className={`text-[11px] truncate leading-tight mt-0.5 ${
                      isSelected ? 'text-white/80' : 'text-[#949ba4]'
                    }`}
                  >
                    {candidate.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
