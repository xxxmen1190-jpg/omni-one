/**
 * Phase 14.8 — Chat Attachments
 * Drag & Drop, Upload Multiple Files, Paste Image, Paste Screenshot,
 * Paste Text, Clipboard Support, Preview Before Send.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FileIntelligence, ParsedFile } from "../../core/files/FileIntelligence";

export interface AttachedFile {
  id: string;
  file: File;
  parsed?: ParsedFile;
  preview?: string;
  status: "pending" | "parsing" | "ready" | "error";
  error?: string;
}

interface ChatAttachmentsProps {
  attachments: AttachedFile[];
  onAttachmentsChange: (attachments: AttachedFile[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export const ChatAttachments: React.FC<ChatAttachmentsProps> = ({
  attachments,
  onAttachmentsChange,
  onRemove,
  disabled = false,
}) => {
  const processFile = useCallback(
    async (file: File): Promise<AttachedFile> => {
      const id = `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const attachment: AttachedFile = {
        id,
        file,
        status: "parsing",
      };

      // Generate preview for images
      if (file.type.startsWith("image/")) {
        attachment.preview = URL.createObjectURL(file);
      }

      try {
        const parsed = await FileIntelligence.parseFile(file);
        attachment.parsed = parsed;
        attachment.status = "ready";
      } catch (error) {
        attachment.status = "error";
        attachment.error = error instanceof Error ? error.message : "Parse failed";
      }

      return attachment;
    },
    []
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (disabled) return;

      const newAttachments: AttachedFile[] = files.map((file) => ({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        status: "parsing" as const,
        preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      }));

      onAttachmentsChange([...attachments, ...newAttachments]);

      // Process files in parallel
      const processed = await Promise.all(files.map(processFile));
      onAttachmentsChange([
        ...attachments,
        ...processed,
      ]);
    },
    [attachments, disabled, onAttachmentsChange, processFile]
  );

  return (
    <div className="space-y-2">
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {attachments.map((attachment) => (
            <AttachmentPreview
              key={attachment.id}
              attachment={attachment}
              onRemove={() => onRemove(attachment.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface AttachmentPreviewProps {
  attachment: AttachedFile;
  onRemove: () => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, onRemove }) => {
  const isImage = attachment.file.type.startsWith("image/");
  const isParsing = attachment.status === "parsing";
  const isError = attachment.status === "error";

  return (
    <div className="relative group flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 max-w-[200px]">
      {/* File icon or image preview */}
      {isImage && attachment.preview ? (
        <img
          src={attachment.preview}
          alt={attachment.file.name}
          className="w-8 h-8 object-cover rounded"
        />
      ) : (
        <span className="text-lg">{getFileIcon(attachment.file)}</span>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-200 truncate font-medium">{attachment.file.name}</p>
        <p className="text-xs text-gray-500">
          {isParsing ? (
            <span className="animate-pulse">Parsing...</span>
          ) : isError ? (
            <span className="text-red-400">{attachment.error}</span>
          ) : (
            formatFileSize(attachment.file.size)
          )}
        </p>
      </div>

      {/* Status indicator */}
      {isParsing && (
        <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      )}
      {isError && <span className="text-red-400 text-xs">⚠</span>}
      {attachment.status === "ready" && <span className="text-green-400 text-xs">✓</span>}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-600 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
};

// Dropzone wrapper for the input area
interface DropZoneWrapperProps {
  onFilesAdded: (files: File[]) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const DropZoneWrapper: React.FC<DropZoneWrapperProps> = ({
  onFilesAdded,
  children,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setIsDragOver(false);
      onFilesAdded(acceptedFiles);
    },
    onDragEnter: () => setIsDragOver(true),
    onDragLeave: () => setIsDragOver(false),
    noClick: true, // Don't open file dialog on click (handled by button)
    disabled,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "text/markdown": [".md", ".markdown"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/json": [".json"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
      "application/zip": [".zip"],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`relative transition-all ${
        isDragActive || isDragOver
          ? "ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900 rounded-xl"
          : ""
      }`}
    >
      <input {...getInputProps()} />
      {(isDragActive || isDragOver) && (
        <div className="absolute inset-0 z-10 bg-purple-500/10 border-2 border-dashed border-purple-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-3xl mb-1">📎</div>
            <p className="text-purple-300 text-sm font-medium">Drop files here</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

// Clipboard paste handler hook
export function useClipboardPaste(
  onFilesAdded: (files: File[]) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];

      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        } else if (item.kind === "string" && item.type === "text/plain") {
          // Paste text as a .txt file
          item.getAsString((text) => {
            if (text.length > 0) {
              const blob = new Blob([text], { type: "text/plain" });
              const file = new File([blob], `pasted-text-${Date.now()}.txt`, {
                type: "text/plain",
              });
              onFilesAdded([file]);
            }
          });
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onFilesAdded(files);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onFilesAdded, enabled]);
}

function getFileIcon(file: File): string {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "📄";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "📝";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "📊";
  if (name.endsWith(".csv")) return "📋";
  if (name.endsWith(".json")) return "🔧";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "📓";
  if (name.endsWith(".zip")) return "🗜️";
  if (name.endsWith(".txt")) return "📃";
  return "📎";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default ChatAttachments;
