/**
 * expenseOcrService
 *
 * Wraps OpenAI's vision-capable model (gpt-4o) to extract structured fields
 * from receipt images. Returns a clean, defensively-validated object the
 * frontend can use to pre-fill the expense form.
 *
 * Flow:
 *   1) sharp downscales the image (max 1600px on the long edge, JPEG q80)
 *      to keep token cost and request size predictable.
 *   2) The image is sent base64-encoded to gpt-4o with a strict JSON-mode
 *      system prompt and a fixed schema.
 *   3) The response is parsed, sanitized, and amounts are converted from
 *      decimal major units to integer cents.
 *
 * If OPENAI_API_KEY is missing OR any step fails, the function never throws
 * to the caller — it returns { ok: false, error } so the route can fall
 * back to manual entry without breaking the upload flow.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pdfParseModule = require('pdf-parse');
const OpenAI = require('openai');
const { logger } = require('../utils/logger');
const Expense = require('../models/Expense');

// Lazy-init the OpenAI client so a missing key doesn't crash boot.
let openaiClient = null;
function getClient() {
  if (openaiClient) return openaiClient;
  const key = process.env.OPENAI_API_KEY;
  if (!key || !key.trim()) return null;
  openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

const MODEL = process.env.OPENAI_OCR_MODEL || 'gpt-4o';
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 80;
const RAW_TEXT_MAX = 8_000; // truncate before persisting
const PDF_TEXT_MAX = 20_000;
const pdfParse =
  typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule?.default;

// ─── Helpers ───────────────────────────────────────────────────────────

/** Convert a decimal major-unit number to integer cents safely. */
function majorToCents(n) {
  if (n === null || n === undefined) return null;
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return null;
  // Math.round avoids 0.1+0.2 style float drift via toFixed(2)
  return Math.round(num * 100);
}

/** Sniff a clean enum value or return null. */
function pickEnum(value, allowed) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return allowed.includes(v) ? v : null;
}

/** Coerce arbitrary OCR output into our wire format. */
function sanitizeParsed(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const taxes = Array.isArray(raw.taxes)
    ? raw.taxes
        .map((t) => {
          if (!t || typeof t !== 'object') return null;
          const type = pickEnum(t.type, Expense.TAX_TYPES);
          const amount = majorToCents(t.amount);
          if (!type || amount === null) return null;
          const rate =
            typeof t.rate === 'number' && t.rate >= 0 && t.rate <= 1 ? t.rate : null;
          return { type, rate, amount };
        })
        .filter(Boolean)
    : [];

  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems
        .slice(0, 30)
        .map((li) => {
          if (!li || typeof li !== 'object') return null;
          const description =
            typeof li.description === 'string'
              ? li.description.trim().slice(0, 200)
              : '';
          const amount = majorToCents(li.amount);
          if (!description && amount === null) return null;
          return { description, amount: amount ?? 0 };
        })
        .filter(Boolean)
    : [];

  // Normalize date — accept YYYY-MM-DD or fall back to ISO 8601.
  let incurredAt = null;
  if (typeof raw.incurredAt === 'string') {
    const d = new Date(raw.incurredAt);
    if (!isNaN(d.getTime())) incurredAt = d.toISOString();
  }

  let confidence =
    typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1
      ? raw.confidence
      : null;

  return {
    vendorName:
      typeof raw.vendorName === 'string' && raw.vendorName.trim()
        ? raw.vendorName.trim().slice(0, 200)
        : null,
    incurredAt,
    subtotal: majorToCents(raw.subtotal),
    taxes,
    total: majorToCents(raw.total),
    currency:
      typeof raw.currency === 'string' && raw.currency.trim()
        ? raw.currency.trim().toUpperCase().slice(0, 3)
        : null,
    paymentMethod: pickEnum(raw.paymentMethod, Expense.PAYMENT_METHODS),
    category: pickEnum(raw.category, Expense.CATEGORIES),
    lineItems,
    confidence,
  };
}

/**
 * Read an image from disk, downscale, and return a base64 data-URL string.
 */
async function imageToDataUrl(absPath) {
  const buf = await sharp(absPath)
    .rotate() // honour EXIF orientation
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const base64 = buf.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

/** Convert an in-memory image buffer to a JPEG data URL. */
function imageBufferToDataUrl(buf) {
  const base64 = buf.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}

/** Extract text from PDF for OCR fallback/input-to-LLM. */
async function extractPdfText(absPath) {
  if (typeof pdfParse !== 'function') {
    throw new Error('pdf_parse_unavailable');
  }
  const buf = await fs.promises.readFile(absPath);
  const parsed = await pdfParse(buf);
  return (parsed?.text || '').replace(/\s+\n/g, '\n').trim();
}

/**
 * Render the first PDF page into a JPEG buffer for vision OCR fallback.
 * Uses sharp's PDF support (if available in the runtime build).
 */
async function renderPdfFirstPageToJpeg(absPath) {
  return sharp(absPath, { density: 220, page: 0 })
    .flatten({ background: '#ffffff' })
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

// ─── System prompt ─────────────────────────────────────────────────────

function buildSystemPrompt() {
  return [
    'You are a Canadian receipt OCR engine for a school accounting system.',
    'Output ONLY a single JSON object that matches the schema below. No markdown, no commentary, no code fences.',
    '',
    'Schema:',
    '{',
    '  "vendorName": string|null,',
    '  "incurredAt": "YYYY-MM-DD"|null,',
    '  "subtotal": number|null,',
    '  "taxes": [{"type":"GST"|"HST"|"PST"|"QST"|"OTHER","rate":number|null,"amount":number}],',
    '  "total": number|null,',
    '  "currency": "CAD"|null,',
    '  "paymentMethod": "cash"|"card"|"bank_transfer"|"cheque"|"e_transfer"|"other"|null,',
    `  "category": ${JSON.stringify(Expense.CATEGORIES)} | null,`,
    '  "lineItems": [{"description":string,"amount":number}],',
    '  "confidence": number',
    '}',
    '',
    'Rules:',
    '- All monetary amounts are decimal major units (e.g. 12.50, NEVER cents).',
    '- Use Canadian conventions. Prefer "CAD" for currency.',
    '- Return null for fields you cannot read with confidence. Do NOT invent values.',
    '- If both subtotal and taxes are visible, total should equal subtotal + sum(taxes.amount).',
    '- "category" is your best classification; admins always review it.',
    '- "confidence" is a single number 0..1 reflecting overall extraction certainty.',
    '- "incurredAt" is the date printed on the receipt, normalized to YYYY-MM-DD.',
  ].join('\n');
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Extract receipt fields from an image on disk.
 *
 * @param {string} absPath - absolute path to a JPEG/PNG/WEBP/HEIC file
 * @returns {Promise<{ok:true, parsed:object, model:string, rawText:string}|{ok:false, error:string}>}
 */
async function extractFromReceipt(absPath) {
  const client = getClient();
  if (!client) {
    return { ok: false, error: 'ocr_unavailable_no_api_key' };
  }
  if (!absPath || !fs.existsSync(absPath)) {
    return { ok: false, error: 'ocr_file_missing' };
  }

  let dataUrl;
  try {
    dataUrl = await imageToDataUrl(absPath);
  } catch (err) {
    logger.warn('OCR: image preprocessing failed', { err: err.message, absPath });
    return { ok: false, error: 'ocr_image_invalid' };
  }

  let response;
  try {
    response = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the receipt fields. Output the JSON object only.',
            },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    });
  } catch (err) {
    logger.error('OCR: OpenAI request failed', {
      err: err.message,
      file: path.basename(absPath),
    });
    return { ok: false, error: 'ocr_provider_error' };
  }

  const rawText = response?.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    logger.warn('OCR: JSON parse failed', { snippet: rawText.slice(0, 200) });
    return { ok: false, error: 'ocr_invalid_json' };
  }

  return {
    ok: true,
    parsed: sanitizeParsed(parsed),
    model: MODEL,
    rawText: rawText.slice(0, RAW_TEXT_MAX),
  };
}

/**
 * Extract receipt fields from a PDF on disk.
 *
 * v2 approach:
 *   1) Extract machine-readable text with pdf-parse.
 *   2) Ask gpt-4o to map that text to our strict JSON schema.
 *
 * For scanned PDFs with little/no text, this can still fail gracefully and
 * callers should fall back to manual entry.
 */
async function extractFromPdfReceipt(absPath) {
  const client = getClient();
  if (!client) {
    return { ok: false, error: 'ocr_unavailable_no_api_key' };
  }
  if (!absPath || !fs.existsSync(absPath)) {
    return { ok: false, error: 'ocr_file_missing' };
  }

  let pdfText = '';
  try {
    pdfText = await extractPdfText(absPath);
  } catch (err) {
    logger.warn('OCR: PDF text extraction failed', { err: err.message, absPath });
    // Continue to vision fallback below.
  }
  if (pdfText && pdfText.length >= 10) {
    const inputText = pdfText.slice(0, PDF_TEXT_MAX);
    let response;
    try {
      response = await client.chat.completions.create({
        model: MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content:
              'Extract the receipt fields from this PDF text. Output JSON object only.\n\n' +
              inputText,
          },
        ],
      });
    } catch (err) {
      logger.error('OCR: OpenAI request failed (pdf-text)', {
        err: err.message,
        file: path.basename(absPath),
      });
      return { ok: false, error: 'ocr_provider_error' };
    }

    const rawText = response?.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(rawText);
      return {
        ok: true,
        parsed: sanitizeParsed(parsed),
        model: MODEL,
        rawText: rawText.slice(0, RAW_TEXT_MAX),
      };
    } catch (err) {
      logger.warn('OCR: JSON parse failed (pdf-text), falling back to vision', {
        snippet: rawText.slice(0, 200),
      });
      // Continue to vision fallback below.
    }
  }

  // Fallback for scanned/image-only PDFs: render first page and run vision OCR.
  let firstPageJpeg;
  try {
    firstPageJpeg = await renderPdfFirstPageToJpeg(absPath);
  } catch (err) {
    logger.warn('OCR: PDF first-page render failed', {
      err: err.message,
      file: path.basename(absPath),
    });
    return { ok: false, error: 'ocr_pdf_no_text' };
  }

  let response;
  try {
    response = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                'Extract the receipt fields from this rendered PDF first page. Output JSON object only.',
            },
            {
              type: 'image_url',
              image_url: { url: imageBufferToDataUrl(firstPageJpeg), detail: 'high' },
            },
          ],
        },
      ],
    });
  } catch (err) {
    logger.error('OCR: OpenAI request failed (pdf-vision)', {
      err: err.message,
      file: path.basename(absPath),
    });
    return { ok: false, error: 'ocr_provider_error' };
  }

  const rawText = response?.choices?.[0]?.message?.content || '';
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    logger.warn('OCR: JSON parse failed (pdf-vision)', { snippet: rawText.slice(0, 200) });
    return { ok: false, error: 'ocr_invalid_json' };
  }

  return {
    ok: true,
    parsed: sanitizeParsed(parsed),
    model: MODEL,
    rawText: rawText.slice(0, RAW_TEXT_MAX),
  };
}

module.exports = {
  extractFromReceipt,
  extractFromPdfReceipt,
  // exposed for unit tests + direct use elsewhere
  _internals: { sanitizeParsed, majorToCents, extractPdfText },
};
