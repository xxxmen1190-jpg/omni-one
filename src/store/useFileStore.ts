/**
 * File Store — Omni One Frontend
 *
 * Server-backed file management.
 * Handles: upload with progress, download, preview, delete, cancel.
 */

import { create } from "zustand";
import { filesApi, ApiError, type UploadedFile } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadStatus = "pending" | "uploading" | "done" | "error" | "cancelled";

export interface UploadTask {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  result?: UploadedFile;
  abortController: AbortController;
}

export interface FileState {
  files: UploadedFile[];
  uploads: UploadTask[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFiles: (projectId?: string) => Promise<void>;
  uploadFile: (file: File, projectId?: string) => Promise<UploadedFile | null>;
  cancelUpload: (taskId: string) => void;
  getDownloadUrl: (fileId: string) => Promise<string>;
  deleteFile: (fileId: string) => Promise<void>;
  clearError: () => void;
  clearCompletedUploads: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

let _taskSeq = 0;
const genTaskId = () => `upload-${Date.now()}-${++_taskSeq}`;

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  uploads: [],
  isLoading: false,
  error: null,

  // ── Load Files ─────────────────────────────────────────────────────────────
  loadFiles: async (projectId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const files = await filesApi.list(projectId);
      set({ files, isLoading: false });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof ApiError ? err.message : "Failed to load files",
      });
    }
  },

  // ── Upload File ────────────────────────────────────────────────────────────
  uploadFile: async (file: File, projectId?: string) => {
    const taskId = genTaskId();
    const abortController = new AbortController();

    const task: UploadTask = {
      id: taskId,
      file,
      status: "pending",
      progress: 0,
      abortController,
    };

    set((s) => ({ uploads: [...s.uploads, task] }));

    const updateTask = (patch: Partial<UploadTask>) => {
      set((s) => ({
        uploads: s.uploads.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
      }));
    };

    updateTask({ status: "uploading" });

    try {
      const result = await filesApi.upload(file, projectId, {
        signal: abortController.signal,
        onProgress: (percent) => updateTask({ progress: percent }),
      });

      updateTask({ status: "done", progress: 100, result });
      set((s) => ({ files: [result, ...s.files] }));
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.code === "CANCELLED") {
        updateTask({ status: "cancelled" });
        return null;
      }
      const msg = err instanceof ApiError ? err.message : "Upload failed";
      updateTask({ status: "error", error: msg });
      return null;
    }
  },

  // ── Cancel Upload ──────────────────────────────────────────────────────────
  cancelUpload: (taskId: string) => {
    const task = get().uploads.find((t) => t.id === taskId);
    if (task && task.status === "uploading") {
      task.abortController.abort();
      set((s) => ({
        uploads: s.uploads.map((t) =>
          t.id === taskId ? { ...t, status: "cancelled" } : t
        ),
      }));
    }
  },

  // ── Get Download URL ───────────────────────────────────────────────────────
  getDownloadUrl: async (fileId: string) => {
    const result = await filesApi.getDownloadUrl(fileId);
    return result.url;
  },

  // ── Delete File ────────────────────────────────────────────────────────────
  deleteFile: async (fileId: string) => {
    // Optimistic
    set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
    try {
      await filesApi.delete(fileId);
    } catch (err) {
      // Revert
      await get().loadFiles();
      throw err;
    }
  },

  // ── Clear Error ────────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),

  // ── Clear Completed Uploads ────────────────────────────────────────────────
  clearCompletedUploads: () => {
    set((s) => ({
      uploads: s.uploads.filter(
        (t) => t.status !== "done" && t.status !== "cancelled"
      ),
    }));
  },
}));

export default useFileStore;
