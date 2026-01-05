import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

/**
 * 通用确认对话框组件
 */
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* 对话框内容 */}
      <div className="relative bg-white/95 rounded-2xl shadow-2xl w-full max-w-[320px] p-6 animate-scale-in border border-white/50">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          {title}
        </h3>
        
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          {message}
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-medium text-sm cursor-pointer transition-all duration-200 shadow-[0_4px_12px_rgba(239,68,68,0.2)] hover:shadow-[0_6px_16px_rgba(239,68,68,0.3)] hover:-translate-y-0.5 active:translate-y-0"
          >
            {confirmText}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm cursor-pointer border border-gray-200 transition-all duration-200 hover:bg-gray-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};
