/**
 * Phase 12.2 — Native Tool Library: Files & Images Tools
 * Handles: PDF, DOCX, TXT, CSV, Excel, Markdown, JSON, Images (OCR, Metadata, Resize, Crop, Format)
 */

import { AbstractToolSDK } from "../sdk/AbstractToolSDK";
import { ToolSDKRegistry } from "../sdk/ToolSDKRegistry";
import { ToolMetadataSDK } from "../sdk/IToolSDK";

function fileMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  isReadOnly = true
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "files",
    capabilities: {
      supportsStreaming: false,
      supportsCancellation: false,
      supportsParallelExecution: true,
      supportsRetry: true,
      isReadOnly,
      requiresNetwork: false,
      hasSideEffects: !isReadOnly,
      maxConcurrency: 4,
    },
    permissions: isReadOnly ? ["read", "filesystem"] : ["read", "write", "filesystem"],
    dangerousPermissions: isReadOnly ? [] : ["write"],
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "Local file operation — no cost" },
    latencyEstimate: { minMs: 10, typicalMs: 100, maxMs: 5000 },
    requiredProviders: [],
    requiredApiKeys: [],
    inputSchema,
    outputSchema,
    tags: ["files", ...tags],
    author: "omni-one",
  };
}

function imageMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = [],
  isReadOnly = true
): ToolMetadataSDK {
  return {
    ...fileMeta(id, name, description, inputSchema, outputSchema, tags, isReadOnly),
    category: "images",
    tags: ["images", ...tags],
  };
}

// ─── File: Read PDF ───────────────────────────────────────────────────────────

export class FilesReadPDFTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-pdf",
        "Files: Read PDF",
        "Extract text content from a PDF file.",
        {
          type: "object",
          properties: {
            path: { type: "string", description: "Absolute path to the PDF file" },
            pages: { type: "array", items: { type: "number" }, description: "Specific page numbers to extract (1-based)" },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            pageCount: { type: "number" },
            pages: { type: "array" },
          },
        },
        ["pdf", "read", "extract"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, pages } = input as { path: string; pages?: number[] };
    // Production: uses pdf-parse or pdfjs-dist
    return {
      path,
      text: `[PDF content from ${path}]`,
      pageCount: 0,
      pages: pages ?? "all",
      note: "Requires pdf-parse library in production runtime",
    };
  }
}

// ─── File: Read DOCX ──────────────────────────────────────────────────────────

export class FilesReadDOCXTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-docx",
        "Files: Read DOCX",
        "Extract text and structure from a Microsoft Word DOCX file.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            includeFormatting: { type: "boolean", default: false },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            paragraphs: { type: "array" },
            tables: { type: "array" },
          },
        },
        ["docx", "word", "read"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path } = input as { path: string };
    return {
      path,
      text: `[DOCX content from ${path}]`,
      paragraphs: [],
      tables: [],
      note: "Requires mammoth or docx library in production runtime",
    };
  }
}

// ─── File: Read TXT ───────────────────────────────────────────────────────────

export class FilesReadTXTTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-txt",
        "Files: Read TXT",
        "Read a plain text file and return its content.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            encoding: { type: "string", default: "utf-8" },
            lineRange: {
              type: "object",
              properties: { start: { type: "number" }, end: { type: "number" } },
            },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            content: { type: "string" },
            lineCount: { type: "number" },
            byteSize: { type: "number" },
          },
        },
        ["txt", "text", "read"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, encoding = "utf-8", lineRange } = input as {
      path: string;
      encoding?: string;
      lineRange?: { start: number; end: number };
    };
    // Production: uses Node.js fs.readFile
    return {
      path,
      content: `[TXT content from ${path}]`,
      lineCount: 0,
      byteSize: 0,
      encoding,
      lineRange: lineRange ?? null,
    };
  }
}

// ─── File: Read CSV ───────────────────────────────────────────────────────────

export class FilesReadCSVTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-csv",
        "Files: Read CSV",
        "Parse a CSV file and return rows as structured JSON.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            delimiter: { type: "string", default: "," },
            hasHeader: { type: "boolean", default: true },
            maxRows: { type: "number" },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            headers: { type: "array" },
            rows: { type: "array" },
            rowCount: { type: "number" },
          },
        },
        ["csv", "spreadsheet", "parse"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, delimiter = ",", hasHeader = true, maxRows } = input as {
      path: string;
      delimiter?: string;
      hasHeader?: boolean;
      maxRows?: number;
    };
    return {
      path,
      headers: [],
      rows: [],
      rowCount: 0,
      delimiter,
      hasHeader,
      maxRows: maxRows ?? null,
      note: "Requires csv-parse library in production runtime",
    };
  }
}

// ─── File: Read Excel ─────────────────────────────────────────────────────────

export class FilesReadExcelTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-excel",
        "Files: Read Excel",
        "Read an Excel (.xlsx/.xls) file and return sheet data as JSON.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            sheetName: { type: "string" },
            sheetIndex: { type: "number", default: 0 },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            sheets: { type: "array" },
            activeSheet: { type: "object" },
          },
        },
        ["excel", "xlsx", "spreadsheet"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, sheetName, sheetIndex = 0 } = input as {
      path: string;
      sheetName?: string;
      sheetIndex?: number;
    };
    return {
      path,
      sheets: [],
      activeSheet: { name: sheetName ?? `Sheet${sheetIndex + 1}`, rows: [] },
      note: "Requires xlsx library in production runtime",
    };
  }
}

// ─── File: Read Markdown ──────────────────────────────────────────────────────

export class FilesReadMarkdownTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-markdown",
        "Files: Read Markdown",
        "Read a Markdown file and return raw text and parsed HTML.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            renderHtml: { type: "boolean", default: false },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            raw: { type: "string" },
            html: { type: "string" },
            headings: { type: "array" },
          },
        },
        ["markdown", "md", "read"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, renderHtml = false } = input as { path: string; renderHtml?: boolean };
    return {
      path,
      raw: `[Markdown content from ${path}]`,
      html: renderHtml ? `<p>[Rendered HTML from ${path}]</p>` : null,
      headings: [],
    };
  }
}

// ─── File: Read JSON ──────────────────────────────────────────────────────────

export class FilesReadJSONTool extends AbstractToolSDK {
  constructor() {
    super(
      fileMeta(
        "files.read-json",
        "Files: Read JSON",
        "Read and parse a JSON file. Supports JSONPath queries.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            jsonPath: { type: "string", description: "Optional JSONPath expression (e.g. $.users[*].name)" },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            data: {},
            query: { type: "string" },
            queryResult: {},
          },
        },
        ["json", "parse", "read"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, jsonPath } = input as { path: string; jsonPath?: string };
    return {
      path,
      data: {},
      query: jsonPath ?? null,
      queryResult: jsonPath ? [] : null,
      note: "Requires Node.js fs and optional jsonpath library in production runtime",
    };
  }
}

// ─── Image: OCR ───────────────────────────────────────────────────────────────

export class ImagesOCRTool extends AbstractToolSDK {
  constructor() {
    super(
      imageMeta(
        "images.ocr",
        "Images: OCR",
        "Extract text from an image using Optical Character Recognition.",
        {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to image file" },
            language: { type: "string", default: "eng", description: "Tesseract language code" },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            confidence: { type: "number" },
            words: { type: "array" },
          },
        },
        ["ocr", "text-extraction", "vision"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, language = "eng" } = input as { path: string; language?: string };
    return {
      path,
      text: `[OCR text from ${path}]`,
      confidence: 0,
      words: [],
      language,
      note: "Requires tesseract.js or Tesseract binary in production runtime",
    };
  }
}

// ─── Image: Metadata ──────────────────────────────────────────────────────────

export class ImagesMetadataTool extends AbstractToolSDK {
  constructor() {
    super(
      imageMeta(
        "images.metadata",
        "Images: Metadata",
        "Read EXIF and image metadata from an image file.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            format: { type: "string" },
            exif: { type: "object" },
            fileSize: { type: "number" },
          },
        },
        ["metadata", "exif", "image-info"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path } = input as { path: string };
    return {
      path,
      width: 0,
      height: 0,
      format: "unknown",
      exif: {},
      fileSize: 0,
      note: "Requires sharp or exifr library in production runtime",
    };
  }
}

// ─── Image: Resize ────────────────────────────────────────────────────────────

export class ImagesResizeTool extends AbstractToolSDK {
  constructor() {
    super(
      imageMeta(
        "images.resize",
        "Images: Resize",
        "Resize an image to specified dimensions.",
        {
          type: "object",
          properties: {
            inputPath: { type: "string" },
            outputPath: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            maintainAspectRatio: { type: "boolean", default: true },
          },
          required: ["inputPath", "outputPath"],
        },
        {
          type: "object",
          properties: {
            outputPath: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
          },
        },
        ["resize", "transform"],
        false
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { inputPath, outputPath, width, height, maintainAspectRatio = true } = input as {
      inputPath: string;
      outputPath: string;
      width?: number;
      height?: number;
      maintainAspectRatio?: boolean;
    };
    return {
      inputPath,
      outputPath,
      width: width ?? null,
      height: height ?? null,
      maintainAspectRatio,
      note: "Requires sharp library in production runtime",
    };
  }
}

// ─── Image: Crop ──────────────────────────────────────────────────────────────

export class ImagesCropTool extends AbstractToolSDK {
  constructor() {
    super(
      imageMeta(
        "images.crop",
        "Images: Crop",
        "Crop an image to a specified region.",
        {
          type: "object",
          properties: {
            inputPath: { type: "string" },
            outputPath: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
          },
          required: ["inputPath", "outputPath", "x", "y", "width", "height"],
        },
        {
          type: "object",
          properties: { outputPath: { type: "string" } },
        },
        ["crop", "transform"],
        false
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { inputPath, outputPath, x, y, width, height } = input as {
      inputPath: string;
      outputPath: string;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    return {
      inputPath,
      outputPath,
      region: { x, y, width, height },
      note: "Requires sharp library in production runtime",
    };
  }
}

// ─── Image: Format Conversion ─────────────────────────────────────────────────

export class ImagesFormatConversionTool extends AbstractToolSDK {
  constructor() {
    super(
      imageMeta(
        "images.format-conversion",
        "Images: Format Conversion",
        "Convert an image from one format to another (PNG, JPEG, WebP, AVIF, GIF, TIFF).",
        {
          type: "object",
          properties: {
            inputPath: { type: "string" },
            outputPath: { type: "string" },
            format: {
              type: "string",
              enum: ["png", "jpeg", "webp", "avif", "gif", "tiff"],
            },
            quality: { type: "number", minimum: 1, maximum: 100, default: 90 },
          },
          required: ["inputPath", "outputPath", "format"],
        },
        {
          type: "object",
          properties: {
            outputPath: { type: "string" },
            format: { type: "string" },
            fileSize: { type: "number" },
          },
        },
        ["convert", "format", "transform"],
        false
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { inputPath, outputPath, format, quality = 90 } = input as {
      inputPath: string;
      outputPath: string;
      format: string;
      quality?: number;
    };
    return {
      inputPath,
      outputPath,
      format,
      quality,
      note: "Requires sharp library in production runtime",
    };
  }
}

// ─── Auto-register all file & image tools ────────────────────────────────────

ToolSDKRegistry.register(new FilesReadPDFTool());
ToolSDKRegistry.register(new FilesReadDOCXTool());
ToolSDKRegistry.register(new FilesReadTXTTool());
ToolSDKRegistry.register(new FilesReadCSVTool());
ToolSDKRegistry.register(new FilesReadExcelTool());
ToolSDKRegistry.register(new FilesReadMarkdownTool());
ToolSDKRegistry.register(new FilesReadJSONTool());
ToolSDKRegistry.register(new ImagesOCRTool());
ToolSDKRegistry.register(new ImagesMetadataTool());
ToolSDKRegistry.register(new ImagesResizeTool());
ToolSDKRegistry.register(new ImagesCropTool());
ToolSDKRegistry.register(new ImagesFormatConversionTool());
