import React, { useState, useEffect } from 'react';
import { X, Compass, Loader2, Users, Search, Check } from 'lucide-react';
import { ServerData, subscribeToPublicServers, joinServer } from '../lib/database';

interface DiscoverServersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: { userId: string; username: string; displayName: string; avatar: string | null };
  joinedServerIds: string[];
  onServerJoined: (serverId: string) => void;
}

export const DiscoverServersModal: React.FC<DiscoverServersModalProps> = ({
  isOpen,
  onClose,
  user,
  joinedServerIds,
  onServerJoined
}) => {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const unsubscribe = subscribeToPublicServers((srvs) => {
      setServers(srvs);
      setLoading(false);
    });
    return unsubscribe;
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = servers.filter((s) =>
    !searchQuery ||
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleJoin = async (serverId: string) => {
    setJoiningId(serverId);
    setJoinError(null);
    try {
      const result = await joinServer(serverId, user);
      if (result.success) {
        onServerJoined(serverId);
        onClose();
      } else {
        setJoinError(result.error || 'Failed to join server');
      }
    } catch (err) {
      console.error('Error joining server:', err);
      setJoinError('Something went wrong');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[720px] max-h-[85vh] bg-[#18191c] border border-[#232428] rounded-[8px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[#232428] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-[#ff6b00]" />
            <h2 className="text-white font-bold text-[20px]">Discover Servers</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#949ba4] hover:text-white hover:bg-[#232428] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 text-[#949ba4] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search servers by name or description..."
              className="w-full bg-[#111214] text-white rounded-[4px] pl-10 pr-3 h-10 text-[15px] outline-none border border-[#232428] focus:border-[#ff6b00] transition-colors"
            />
          </div>
        </div>

        {/* Server list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#949ba4]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Compass className="w-10 h-10 text-[#4e5058] mb-3" />
              <p className="text-[#949ba4] text-[15px]">No public servers found{searchQuery ? ' matching your search' : ''}.</p>
              <p className="text-[#80848e] text-[13px] mt-1">Check back later or create your own!</p>
            </div>
          ) : (
            filtered.map((server) => {
              const hasJoined = joinedServerIds.includes(server.id);
              return (
                <div
                  key={server.id}
                  className="bg-[#111214] border border-[#232428] rounded-[6px] p-4 flex items-center gap-4 hover:border-[#4e5058] transition-colors"
                >
                  {/* Server icon */}
                  <div className="w-14 h-14 rounded-[12px] bg-[#2b2d31] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {server.icon ? (
                      <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-[18px]">
                        {server.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Server info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-[16px] truncate">{server.name}</h3>
                    {server.description && (
                      <p className="text-[#949ba4] text-[13px] mt-0.5 line-clamp-2">{server.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-[#80848e]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {server.memberCount || 0} member{(server.memberCount || 0) === 1 ? '' : 's'}
                      </span>
                      <span>Created by @{server.ownerUsername}</span>
                    </div>
                  </div>

                  {/* Join button */}
                  <div className="flex-shrink-0">
                    {hasJoined ? (
                      <div className="flex items-center gap-1.5 text-[#23a55a] text-[13px] font-medium px-3 py-2">
                        <Check className="w-4 h-4" />
                        Joined
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={joiningId === server.id}
                        onClick={() => handleJoin(server.id)}
                        className="px-4 h-9 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2"
                      >
                        {joiningId === server.id && <Loader2 className="w-4 h-4 animate-spin" />}
                        Join
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Error toast */}
        {joinError && (
          <div className="px-6 pb-4">
            <div className="bg-[#f23f43]/15 border border-[#f23f43]/40 text-[#f23f43] text-[13px] rounded-[4px] px-3 py-2">
              {joinError}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
