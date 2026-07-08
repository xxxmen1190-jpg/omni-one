/**
 * Phase 14.1 — Universal File Intelligence
 * Reads, parses, summarizes, and enables Q&A on all major file types.
 * Connects to RAG, memory, and OmniBrain.
 */

import { Logger } from "../system/Logger";

export type SupportedFileType =
  | "pdf"
  | "docx"
  | "txt"
  | "csv"
  | "xlsx"
  | "json"
  | "md"
  | "image"
  | "zip"
  | "unknown";

export interface ParsedFile {
  id: string;
  name: string;
  type: SupportedFileType;
  size: number;
  content: string;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
  images?: Array<{ src: string; caption?: string }>;
  metadata: Record<string, any>;
  rawBase64?: string;
  mimeType: string;
  parsedAt: number;
}

export interface FileQAResult {
  question: string;
  answer: string;
  sources: string[];
  confidence: number;
}

export class FileIntelligence {
  /**
   * Detect file type from MIME type or file extension.
   */
  static detectType(file: File): SupportedFileType {
    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    )
      return "docx";
    if (mime === "text/plain" || name.endsWith(".txt")) return "txt";
    if (mime === "text/csv" || name.endsWith(".csv")) return "csv";
    if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls")
    )
      return "xlsx";
    if (mime === "application/json" || name.endsWith(".json")) return "json";
    if (mime === "text/markdown" || name.endsWith(".md") || name.endsWith(".markdown"))
      return "md";
    if (mime.startsWith("image/")) return "image";
    if (mime === "application/zip" || name.endsWith(".zip")) return "zip";
    return "unknown";
  }

  /**
   * Parse a file and extract its content.
   */
  static async parseFile(file: File): Promise<ParsedFile> {
    const type = this.detectType(file);
    const id = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    Logger.info(`[FileIntelligence] Parsing ${file.name} as ${type}`);

    try {
      switch (type) {
        case "txt":
        case "md":
          return await this.parsePlainText(file, id, type);
        case "json":
          return await this.parseJSON(file, id);
        case "csv":
          return await this.parseCSV(file, id);
        case "xlsx":
          return await this.parseXLSX(file, id);
        case "pdf":
          return await this.parsePDF(file, id);
        case "docx":
          return await this.parseDOCX(file, id);
        case "image":
          return await this.parseImage(file, id);
        case "zip":
          return await this.parseZIP(file, id);
        default:
          return await this.parsePlainText(file, id, "unknown");
      }
    } catch (error) {
      Logger.error(`[FileIntelligence] Failed to parse ${file.name}`, { error });
      return {
        id,
        name: file.name,
        type,
        size: file.size,
        content: `[Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}]`,
        metadata: { error: true },
        mimeType: file.type,
        parsedAt: Date.now(),
      };
    }
  }

  private static async parsePlainText(
    file: File,
    id: string,
    type: SupportedFileType
  ): Promise<ParsedFile> {
    const content = await file.text();
    return {
      id,
      name: file.name,
      type,
      size: file.size,
      content,
      metadata: { lines: content.split("\n").length, chars: content.length },
      mimeType: file.type || "text/plain",
      parsedAt: Date.now(),
    };
  }

  private static async parseJSON(file: File, id: string): Promise<ParsedFile> {
    const text = await file.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const content = parsed
      ? JSON.stringify(parsed, null, 2)
      : text;
    return {
      id,
      name: file.name,
      type: "json",
      size: file.size,
      content,
      metadata: {
        valid: parsed !== null,
        keys: parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0,
      },
      mimeType: "application/json",
      parsedAt: Date.now(),
    };
  }

  private static async parseCSV(file: File, id: string): Promise<ParsedFile> {
    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0]?.split(",").map((h) => h.trim().replace(/^"|"$/g, "")) ?? [];
    const rows = lines.slice(1).map((line) =>
      line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""))
    );

    const tableText = [headers.join(" | "), ...rows.map((r) => r.join(" | "))].join("\n");

    return {
      id,
      name: file.name,
      type: "csv",
      size: file.size,
      content: tableText,
      tables: [{ headers, rows }],
      metadata: { rows: rows.length, columns: headers.length },
      mimeType: "text/csv",
      parsedAt: Date.now(),
    };
  }

  private static async parseXLSX(file: File, id: string): Promise<ParsedFile> {
    const { read, utils } = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = read(buffer, { type: "array" });

    const tables: Array<{ headers: string[]; rows: string[][] }> = [];
    let allContent = "";

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: string[][] = utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
      if (data.length === 0) continue;

      const headers = (data[0] || []).map(String);
      const rows = data.slice(1).map((r) => r.map(String));
      tables.push({ headers, rows });

      allContent += `\n## Sheet: ${sheetName}\n`;
      allContent += headers.join(" | ") + "\n";
      allContent += rows.map((r) => r.join(" | ")).join("\n");
    }

    return {
      id,
      name: file.name,
      type: "xlsx",
      size: file.size,
      content: allContent.trim(),
      tables,
      metadata: { sheets: workbook.SheetNames.length },
      mimeType: file.type,
      parsedAt: Date.now(),
    };
  }

  private static async parsePDF(file: File, id: string): Promise<ParsedFile> {
    // Use PDF.js for browser-side PDF parsing
    try {
      const pdfjsLib = await import("pdfjs-dist");
      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let content = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        content += `\n[Page ${i}]\n${pageText}`;
      }

      return {
        id,
        name: file.name,
        type: "pdf",
        size: file.size,
        content: content.trim(),
        metadata: { pages: pdf.numPages },
        mimeType: "application/pdf",
        parsedAt: Date.now(),
      };
    } catch (error) {
      // Fallback: return file as base64 for vision analysis
      const base64 = await this.fileToBase64(file);
      return {
        id,
        name: file.name,
        type: "pdf",
        size: file.size,
        content: "[PDF content requires vision analysis]",
        rawBase64: base64,
        metadata: { requiresVision: true },
        mimeType: "application/pdf",
        parsedAt: Date.now(),
      };
    }
  }

  private static async parseDOCX(file: File, id: string): Promise<ParsedFile> {
    const mammoth = await import("mammoth");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const content = result.value;

    return {
      id,
      name: file.name,
      type: "docx",
      size: file.size,
      content,
      metadata: {
        warnings: result.messages.length,
        chars: content.length,
        words: content.split(/\s+/).length,
      },
      mimeType: file.type,
      parsedAt: Date.now(),
    };
  }

  private static async parseImage(file: File, id: string): Promise<ParsedFile> {
    const base64 = await this.fileToBase64(file);
    return {
      id,
      name: file.name,
      type: "image",
      size: file.size,
      content: "[Image — use Vision System for analysis]",
      rawBase64: base64,
      images: [{ src: `data:${file.type};base64,${base64}` }],
      metadata: { requiresVision: true, mimeType: file.type },
      mimeType: file.type,
      parsedAt: Date.now(),
    };
  }

  private static async parseZIP(file: File, id: string): Promise<ParsedFile> {
    const JSZip = (await import("jszip")).default;
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const files: string[] = [];
    let content = "## ZIP Contents\n";

    for (const [name, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        files.push(name);
        content += `- ${name}\n`;
      }
    }

    // Extract text files
    let extractedContent = "";
    for (const [name, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir && /\.(txt|md|json|csv|ts|js|py|html|css)$/i.test(name)) {
        try {
          const text = await zipEntry.async("string");
          extractedContent += `\n### ${name}\n\`\`\`\n${text.slice(0, 2000)}\n\`\`\`\n`;
        } catch {
          // skip binary files
        }
      }
    }

    return {
      id,
      name: file.name,
      type: "zip",
      size: file.size,
      content: content + extractedContent,
      metadata: { fileCount: files.length, files },
      mimeType: "application/zip",
      parsedAt: Date.now(),
    };
  }

  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Generate a summary of parsed file content.
   */
  static generateSummary(parsed: ParsedFile): string {
    const lines = [`**File:** ${parsed.name}`, `**Type:** ${parsed.type.toUpperCase()}`, `**Size:** ${(parsed.size / 1024).toFixed(1)} KB`];

    if (parsed.metadata.pages) lines.push(`**Pages:** ${parsed.metadata.pages}`);
    if (parsed.metadata.rows) lines.push(`**Rows:** ${parsed.metadata.rows}`);
    if (parsed.metadata.sheets) lines.push(`**Sheets:** ${parsed.metadata.sheets}`);
    if (parsed.metadata.fileCount) lines.push(`**Files in ZIP:** ${parsed.metadata.fileCount}`);
    if (parsed.metadata.words) lines.push(`**Words:** ${parsed.metadata.words}`);

    lines.push("", "**Content Preview:**", parsed.content.slice(0, 500) + (parsed.content.length > 500 ? "..." : ""));

    return lines.join("\n");
  }

  /**
   * Build a prompt for LLM Q&A on file content.
   */
  static buildQAPrompt(parsed: ParsedFile, question: string): string {
    const maxContent = 8000;
    const truncated = parsed.content.length > maxContent
      ? parsed.content.slice(0, maxContent) + "\n...[content truncated]"
      : parsed.content;

    return `You are analyzing the file "${parsed.name}" (${parsed.type.toUpperCase()}).

File Content:
${truncated}

User Question: ${question}

Please answer the question based on the file content above. Be specific and cite relevant parts of the content.`;
  }

  /**
   * Extract tables from parsed file.
   */
  static extractTables(parsed: ParsedFile): Array<{ headers: string[]; rows: string[][] }> {
    return parsed.tables || [];
  }
}
