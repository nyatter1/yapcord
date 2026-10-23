import React from 'react';
import { User } from 'lucide-react';
import { TypingUser } from '../lib/database';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) {
    return <div className="h-6" aria-hidden="true" />;
  }

  const count = typingUsers.length;
  // Maximum 5 avatars shown on one line
  const displayedUsers = typingUsers.slice(0, 5);

  const renderText = () => {
    if (count === 1) {
      const u1 = typingUsers[0];
      return (
        <span>
          <strong className="font-semibold text-white">
            {u1.displayName || u1.username}
          </strong>{' '}
          is typing
        </span>
      );
    }

    if (count === 2) {
      const u1 = typingUsers[0];
      const u2 = typingUsers[1];
      return (
        <span>
          <strong className="font-semibold text-white">
            {u1.displayName || u1.username}
          </strong>{' '}
          and{' '}
          <strong className="font-semibold text-white">
            {u2.displayName || u2.username}
          </strong>{' '}
          are typing
        </span>
      );
    }

    if (count === 3) {
      const u1 = typingUsers[0];
      const u2 = typingUsers[1];
      const u3 = typingUsers[2];
      return (
        <span>
          <strong className="font-semibold text-white">
            {u1.displayName || u1.username}
          </strong>
          ,{' '}
          <strong className="font-semibold text-white">
            {u2.displayName || u2.username}
          </strong>
          , and{' '}
          <strong className="font-semibold text-white">
            {u3.displayName || u3.username}
          </strong>{' '}
          are typing
        </span>
      );
    }

    if (count >= 100) {
      return (
        <span>
          <strong className="font-semibold text-white">100+ People</strong> are typing
        </span>
      );
    }

    // More than 3 people typing (e.g. 4 to 99)
    return (
      <span>
        <strong className="font-semibold text-white">3+ People</strong> are typing
      </span>
    );
  };

  return (
    <div className="h-6 flex items-center gap-2 px-1 text-[12px] text-[#dbdee1] select-none animate-in fade-in duration-150">
      {/* Overlapping Avatars (max 5) */}
      <div className="flex items-center">
        {displayedUsers.map((u, idx) => (
          <div
            key={u.username + idx}
            className="w-5 h-5 rounded-full ring-2 ring-[#111214] overflow-hidden -ml-1.5 first:ml-0 bg-[#2b2d31] flex items-center justify-center text-white flex-shrink-0 shadow-sm transition-transform hover:scale-110"
            title={u.displayName || u.username}
          >
            {u.avatar ? (
              <img src={u.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-3 h-3 text-[#ff6b00]" />
            )}
          </div>
        ))}
      </div>

      {/* Typing user text */}
      <div className="truncate flex items-center">
        {renderText()}
        {/* Animated Typing Wave Dots */}
        <span className="inline-flex items-center gap-0.5 ml-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 bg-[#ff6b00] rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 bg-[#ff6b00] rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 bg-[#ff6b00] rounded-full animate-bounce" />
        </span>
      </div>
    </div>
  );
};
