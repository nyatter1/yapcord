import React, { useState } from 'react';
import { Users, UserPlus, Search, MessageSquare, Trash2, Check, AlertCircle, Loader2, User } from 'lucide-react';
import { FriendItem } from '../lib/database';

interface FriendsViewProps {
  friends: FriendItem[];
  filterTab: 'online' | 'all' | 'add';
  onFilterTabChange: (tab: 'online' | 'all' | 'add') => void;
  addFriendInput: string;
  onAddFriendInputChange: (val: string) => void;
  onAddFriendSubmit: (e: React.FormEvent) => void;
  addFriendStatus: { type: 'success' | 'error'; message: string } | null;
  isAddingFriend: boolean;
  onOpenDm: (friendUsername: string) => void;
  onRemoveFriend: (friendUsername: string) => void;
  statusConfig: Record<string, { label: string; color: string; bgClass: string }>;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  filterTab,
  onFilterTabChange,
  addFriendInput,
  onAddFriendInputChange,
  onAddFriendSubmit,
  addFriendStatus,
  isAddingFriend,
  onOpenDm,
  onRemoveFriend,
  statusConfig
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const onlineFriends = friends.filter((f) => f.status && f.status !== 'offline');

  const displayedFriends = (filterTab === 'online' ? onlineFriends : friends).filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
      (f.displayName && f.displayName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111214] min-w-0 select-none">
      {/* Top Header Bar */}
      <div className="h-12 border-b border-[#18191c] bg-[#18191c] px-5 flex items-center justify-between flex-shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white font-bold text-[15px]">
            <Users className="w-5 h-5 text-[#80848e]" />
            <span>Friends</span>
          </div>

          <div className="w-[1px] h-4 bg-[#2e3035]" />

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFilterTabChange('online')}
              className={`px-3 py-1 rounded-[4px] text-[14px] font-semibold transition-colors cursor-pointer ${
                filterTab === 'online'
                  ? 'bg-[#2b2d31] text-white shadow-xs'
                  : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
              }`}
            >
              Online ({onlineFriends.length})
            </button>

            <button
              type="button"
              onClick={() => onFilterTabChange('all')}
              className={`px-3 py-1 rounded-[4px] text-[14px] font-semibold transition-colors cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-[#2b2d31] text-white shadow-xs'
                  : 'text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#232428]'
              }`}
            >
              All ({friends.length})
            </button>

            <button
              type="button"
              onClick={() => onFilterTabChange('add')}
              className={`px-3 py-1 rounded-[4px] text-[14px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'add'
                  ? 'bg-[#ff6b00] text-white shadow-[0_0_12px_rgba(255,107,0,0.35)]'
                  : 'bg-[#ff6b00]/20 text-[#ff8f3d] hover:bg-[#ff6b00] hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Friend</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {filterTab === 'add' ? (
          /* ADD FRIEND SCREEN */
          <div className="max-w-xl mx-auto py-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-wide mb-1">
              Add Friend
            </h2>
            <p className="text-[#949ba4] text-[14px] mb-6">
              You can add friends with their Yapzo handle or email address.
            </p>

            <form
              onSubmit={onAddFriendSubmit}
              className="relative flex items-center rounded-[8px] bg-[#1e1f22] border border-[#2b2d31] focus-within:border-[#ff6b00] p-3 transition-colors mb-4"
            >
              <input
                type="text"
                value={addFriendInput}
                onChange={(e) => onAddFriendInputChange(e.target.value)}
                placeholder="Enter a username or email"
                className="bg-transparent text-white placeholder-[#80848e] text-[15px] outline-none flex-1 pr-3"
                autoFocus
              />

              <button
                type="submit"
                disabled={isAddingFriend || !addFriendInput.trim()}
                className="px-4 py-1.5 bg-[#ff6b00] hover:bg-[#e55b00] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[4px] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isAddingFriend && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isAddingFriend ? 'Adding...' : 'Send Friend Request'}</span>
              </button>
            </form>

            {/* Status alerts */}
            {addFriendStatus && (
              <div
                className={`p-3 rounded-[6px] text-[13px] flex items-center gap-2.5 transition-all mb-6 ${
                  addFriendStatus.type === 'success'
                    ? 'bg-[#23a55a]/15 border border-[#23a55a]/40 text-[#2ecc71]'
                    : 'bg-[#f23f43]/15 border border-[#f23f43]/40 text-[#ff6b6b]'
                }`}
              >
                {addFriendStatus.type === 'success' ? (
                  <Check className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{addFriendStatus.message}</span>
              </div>
            )}

            {/* Discord/Yapzo Info Card */}
            <div className="mt-8 border-t border-[#232428] pt-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#18191c] border border-[#232428] flex items-center justify-center text-[#ff6b00] mb-3">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-white font-semibold text-[15px] mb-1">
                Yapzo is better with friends!
              </h3>
              <p className="text-[#949ba4] text-[13px] max-w-sm">
                Connect with your friends to chat in direct messages, share images and GIFs, and hang out together.
              </p>
            </div>
          </div>
        ) : (
          /* ONLINE / ALL FRIENDS LIST */
          <div className="max-w-4xl mx-auto">
            {/* Search filter bar */}
            <div className="relative mb-5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends"
                className="w-full bg-[#1e1f22] text-white placeholder-[#80848e] text-[14px] rounded-[6px] pl-9 pr-4 py-2 border border-[#2b2d31] outline-none focus:border-[#ff6b00]/60 transition-colors"
              />
              <Search className="w-4 h-4 text-[#80848e] absolute left-3 top-2.5" />
            </div>

            {/* List count header */}
            <div className="text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-3">
              {filterTab === 'online' ? `Online — ${displayedFriends.length}` : `All Friends — ${displayedFriends.length}`}
            </div>

            {/* Friends rows */}
            {displayedFriends.length > 0 ? (
              <div className="space-y-1">
                {displayedFriends.map((friend) => {
                  const statusInfo = statusConfig[friend.status || 'offline'] || statusConfig.offline;
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-2.5 rounded-[8px] hover:bg-[#18191c]/80 border-t border-[#1e1f22] group transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-[#18191c] overflow-hidden flex items-center justify-center text-white ring-2 ring-[#232428]">
                            {friend.avatar ? (
                              <img src={friend.avatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-[#ff6b00]" />
                            )}
                          </div>
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111214] ${statusInfo.bgClass}`}
                            title={statusInfo.label}
                          />
                        </div>

                        {/* Name and Handle */}
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-white text-[15px] truncate">
                              {friend.displayName || friend.username}
                            </span>
                            <span className="text-[12px] text-[#949ba4] truncate">
                              @{friend.username}
                            </span>
                          </div>
                          <span className="text-[12px] text-[#80848e] truncate">
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenDm(friend.username)}
                          className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          title={`Message @${friend.displayName || friend.username}`}
                        >
                          <MessageSquare className="w-4 h-4 text-[#ff6b00]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onRemoveFriend(friend.username)}
                          className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#f23f43]/20 hover:text-[#f23f43] text-[#b5bac1] flex items-center justify-center transition-colors cursor-pointer"
                          title="Remove Friend"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty state */
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-[#18191c] border border-[#232428] flex items-center justify-center text-[#ff6b00] mb-4">
                  <Users className="w-10 h-10" />
                </div>
                <h3 className="text-white font-semibold text-[16px] mb-1">
                  {filterTab === 'online' ? 'No friends are online right now.' : 'No friends found.'}
                </h3>
                <p className="text-[#949ba4] text-[13px] max-w-sm mb-4">
                  Add some friends with their Yapzo handle or email to start chatting and hanging out!
                </p>
                <button
                  type="button"
                  onClick={() => onFilterTabChange('add')}
                  className="px-4 py-2 bg-[#ff6b00] hover:bg-[#e55b00] text-white font-medium text-[14px] rounded-[4px] transition-colors cursor-pointer shadow-sm"
                >
                  Add Friend
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
