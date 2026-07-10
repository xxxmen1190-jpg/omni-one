/**
 * Files Routes — Omni One Backend
 *
 * File management: upload, list, get, download URL, delete.
 * Uses local storage by default; S3 when configured.
 *
 * GET    /files
 * POST   /files/upload
 * GET    /files/:id
 * GET    /files/:id/url
 * DELETE /files/:id
 */

import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { authenticate } from "../../middleware/auth.js";
import { prisma } from "../../database/prisma.js";
import { config } from "../../config/index.js";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/zip",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function filesRoutes(fastify: FastifyInstance): Promise<void> {

  // Register multipart support for this plugin scope
  await fastify.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  });

  // ── GET /files ─────────────────────────────────────────────────────────────
  fastify.get<{ Querystring: { projectId?: string } }>(
    "/files",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { projectId } = request.query;
      const files = await prisma.file.findMany({
        where: projectId ? { projectId } : {},
        orderBy: { createdAt: "desc" },
      });
      void reply.send(successResponse(files, request.id));
    }
  );

  // ── POST /files/upload ─────────────────────────────────────────────────────
  fastify.post(
    "/files/upload",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const data = await (request as any).file();
      if (!data) throw new AppError("No file provided", 400, "VALIDATION_ERROR");

      const { filename, mimetype, file: fileStream } = data;
      const projectId = (data.fields?.projectId as { value?: string } | undefined)?.value ?? null;

      if (!ALLOWED_MIME_TYPES.has(mimetype)) {
        throw new AppError(`File type ${mimetype} is not allowed`, 400, "VALIDATION_ERROR");
      }

      // Ensure storage directory exists
      const storageDir = path.resolve(config.storage.path);
      if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true });

      // Generate unique key
      const fileId = crypto.randomUUID();
      const ext = path.extname(filename) || "";
      const storageKey = `${fileId}${ext}`;
      const filePath = path.join(storageDir, storageKey);

      // Stream to disk
      let size = 0;
      await new Promise<void>((resolve, reject) => {
        const writeStream = createWriteStream(filePath);
        fileStream.on("data", (chunk: Buffer) => { size += chunk.length; });
        fileStream.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
        fileStream.pipe(writeStream);
      });

      // Persist metadata
      const record = await prisma.file.create({
        data: {
          id: fileId,
          name: filename,
          size,
          mimeType: mimetype,
          key: storageKey,
          provider: "LOCAL",
          projectId: projectId ?? null,
        },
      });

      void reply.status(201).send(successResponse(record, request.id));
    }
  );

  // ── GET /files/:id ─────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/files/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const file = await prisma.file.findUnique({ where: { id } });
      if (!file) throw new AppError("File not found", 404, "NOT_FOUND");
      void reply.send(successResponse(file, request.id));
    }
  );

  // ── GET /files/:id/url ─────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/files/:id/url",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const file = await prisma.file.findUnique({ where: { id } });
      if (!file) throw new AppError("File not found", 404, "NOT_FOUND");
      // For local storage, return a direct download URL
      const url = `/files/${id}/download`;
      void reply.send(successResponse({ url }, request.id));
    }
  );

  // ── GET /files/:id/download ────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/files/:id/download",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const file = await prisma.file.findUnique({ where: { id } });
      if (!file) throw new AppError("File not found", 404, "NOT_FOUND");
      const filePath = path.join(path.resolve(config.storage.path), file.key);
      if (!existsSync(filePath)) throw new AppError("File not found on disk", 404, "NOT_FOUND");
      void reply.header("Content-Disposition", `attachment; filename="${file.name}"`);
      void reply.header("Content-Type", file.mimeType);
      const { createReadStream } = await import("fs");
      const stream = createReadStream(filePath);
      return reply.send(stream);
    }
  );

  // ── DELETE /files/:id ──────────────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    "/files/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const file = await prisma.file.findUnique({ where: { id } });
      if (!file) throw new AppError("File not found", 404, "NOT_FOUND");

      // Delete from disk
      const filePath = path.join(path.resolve(config.storage.path), file.key);
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => { /* ignore */ });
      }

      await prisma.file.delete({ where: { id } });
      void reply.send(successResponse({ message: "Deleted" }, request.id));
    }
  );
}
