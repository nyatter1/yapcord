import React, { useState, useRef } from 'react';
import { X, Loader2, Upload, Camera, Check } from 'lucide-react';
import { uploadToCloudinary } from '../lib/cloudinary';
import { createServer } from '../lib/database';

interface CreateServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  owner: { userId: string; username: string; displayName: string; avatar: string | null };
  onServerCreated: (serverId: string) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  owner,
  onServerCreated
}) => {
  const [step, setStep] = useState<'name' | 'customize'>('name');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setIconUrl(url);
    } catch (err) {
      console.error('Failed to upload icon:', err);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const serverId = await createServer(owner, {
        name: name.trim(),
        description: description.trim(),
        icon: iconUrl,
        isPublic
      });
      onServerCreated(serverId);
      // Reset
      setStep('name');
      setName('');
      setDescription('');
      setIconUrl(null);
      setIsPublic(false);
      onClose();
    } catch (err) {
      console.error('Error creating server:', err);
      setError('Failed to create server. Please try again.');
    } finally {
      setIsCreating(false);
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
          <h2 className="text-white font-bold text-[20px]">
            {step === 'name' ? 'Create a Server' : 'Customize Your Server'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-[#949ba4] hover:text-white hover:bg-[#232428] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'name' ? (
          <div className="px-5 pb-2">
            <p className="text-[#949ba4] text-[14px] mb-4 leading-relaxed">
              Give your new server a personality with a name. You can always change it later.
            </p>
            <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
              Server Name <span className="text-[#ff5c00]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep('customize'); }}
              placeholder="My Awesome Server"
              autoFocus
              className="w-full bg-[#111214] text-white rounded-[3px] px-3 h-10 text-[15px] outline-none border border-transparent focus:border-[#ff6b00] transition-colors"
            />
          </div>
        ) : (
          <div className="px-5 pb-2">
            <p className="text-[#949ba4] text-[14px] mb-4 leading-relaxed">
              Upload an icon and add a description to make your server stand out.
            </p>

            {/* Icon upload */}
            <div className="flex items-center gap-4 mb-4">
              <div
                onClick={() => iconInputRef.current?.click()}
                className="w-20 h-20 rounded-full bg-[#2b2d31] border-2 border-dashed border-[#4e5058] hover:border-[#ff6b00] flex items-center justify-center cursor-pointer overflow-hidden transition-colors group flex-shrink-0"
              >
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-[#ff6b00] animate-spin" />
                ) : iconUrl ? (
                  <img src={iconUrl} alt="Server icon" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-6 h-6 text-[#949ba4] group-hover:text-[#ff6b00] transition-colors" />
                )}
              </div>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  className="text-[13px] text-[#ff6b00] hover:underline cursor-pointer font-medium"
                >
                  {iconUrl ? 'Change icon' : 'Upload icon'}
                </button>
                <p className="text-[11px] text-[#949ba4] mt-1">PNG or JPG, recommended 256x256</p>
              </div>
            </div>

            <input
              type="file"
              ref={iconInputRef}
              onChange={handleIconUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Description */}
            <label className="block text-[12px] font-bold text-[#b5bac1] uppercase tracking-wider mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what this server is about..."
              rows={3}
              maxLength={190}
              className="w-full bg-[#111214] text-white rounded-[3px] p-3 text-[14px] outline-none border border-transparent focus:border-[#ff6b00] transition-colors resize-none mb-4"
            />

            {/* Public toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none mb-1">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 rounded-[4px] border border-[#4e5058] bg-[#111214] peer-checked:bg-[#ff6b00] peer-checked:border-[#ff6b00] flex items-center justify-center transition-colors">
                {isPublic && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </div>
              <span className="text-[13px] text-[#dbdee1] leading-tight">
                Make server public (appears in Discover)
              </span>
            </label>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-5 pb-2 text-[13px] text-[#f23f43]">{error}</div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 bg-[#141517] border-t border-[#232428] flex items-center justify-between">
          {step === 'customize' ? (
            <button
              type="button"
              onClick={() => setStep('name')}
              className="text-[14px] text-[#949ba4] hover:text-white cursor-pointer font-medium"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-[14px] text-[#949ba4] hover:text-white cursor-pointer font-medium"
            >
              Cancel
            </button>
          )}

          {step === 'name' ? (
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep('customize')}
              className="px-4 h-9 bg-[#ff6b00] hover:bg-[#e55b00] active:bg-[#cc4e00] disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              disabled={isCreating || !name.trim()}
              onClick={handleCreate}
              className="px-5 h-9 bg-[#23a55a] hover:bg-[#1f9350] active:bg-[#1a7f45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-[14px] rounded-[3px] transition-colors cursor-pointer flex items-center gap-2"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCreating ? 'Creating...' : 'Create Server'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
