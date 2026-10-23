import React, { useState, useEffect } from 'react';
import { X, Link2, Loader2, ArrowRight } from 'lucide-react';
import { joinServerByInvite, ServerData, getServerById } from '../lib/database';

interface JoinByInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  user: { userId: string; username: string; displayName: string; avatar: string | null };
  onServerJoined: (serverId: string) => void;
}

export const JoinByInviteModal: React.FC<JoinByInviteModalProps> = ({
  isOpen,
  onClose,
  initialCode,
  user,
  onServerJoined
}) => {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewServer, setPreviewServer] = useState<ServerData | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOpen && initialCode) {
      setCode(initialCode);
    }
    if (!isOpen) {
      setCode('');
      setError(null);
      setPreviewServer(null);
    }
  }, [isOpen, initialCode]);

  if (!isOpen) return null;

  const handleCheckCode = async (codeVal: string) => {
    if (!codeVal.trim()) {
      setPreviewServer(null);
      return;
    }
    setIsChecking(true);
    setError(null);
    try {
      const result = await joinServerByInvite(codeVal.trim(), user);
      if (result.success && result.serverId) {
        const server = await getServerById(result.serverId);
        setPreviewServer(server);
        setError(null);
      } else {
        setPreviewServer(null);
      }
    } catch (err) {
      setPreviewServer(null);
    } finally {
      setIsChecking(false);
    }
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setIsJoining(true);
    setError(null);
    try {
      const result = await joinServerByInvite(code.trim(), user);
      if (result.success && result.serverId) {
        onServerJoined(result.serverId);
        onClose();
      } else {
        setError(result.error || 'Failed to join server');
      }
    } catch (err) {
      console.error('Error joining server:', err);
      setError('Something went wrong');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[#18191c] border border-[#232428] rounded-[8px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link2 className="w-5 h-5 text-[#ff6b00]" />
            <h2 className="text-white font-bold text-[20px]">Join a Server</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#949ba4] hover:text-white hover:bg-[#232428] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-2">
          <p className="text-[#949ba4] text-[14px] mb-4 leading-relaxed">
            Enter an invite code below to join a server.
          </p>
          <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
            Invite Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError(null);
              if (e.target.value.trim().length >= 6) {
                handleCheckCode(e.target.value.trim());
              } else {
                setPreviewServer(null);
              }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) handleJoin(); }}
            placeholder="Paste invite code here..."
            autoFocus
            className="w-full bg-[#111214] text-white rounded-[3px] px-3 h-10 text-[15px] outline-none border border-[#232428] focus:border-[#ff6b00] transition-colors font-mono"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 pb-2 text-[13px] text-[#f23f43] flex items-center gap-1.5">
            <X className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 bg-[#141517] border-t border-[#232428] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="text-[14px] text-[#949ba4] hover:text-white cursor-pointer font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isJoining || !code.trim()}
            onClick={handleJoin}
            className="px-5 h-9 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2"
          >
            {isJoining || isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {isJoining ? 'Joining...' : 'Join Server'}
          </button>
        </div>
      </div>
    </div>
  );
};
