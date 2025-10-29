const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

/**
 * Generate PDF from HTML content
 * @param {Object} options - PDF generation options
 * @param {string} options.html - HTML content to convert
 * @param {string} options.filename - Output filename
 * @param {string} options.outputDir - Output directory (default: uploads/pdfs)
 * @returns {Promise<Object>} - PDF file information
 */
const generatePDF = async (options) => {
  const {
    html,
    filename,
    outputDir = 'uploads/pdfs',
    includeBackground = true,
    format = 'A4',
    margin = {
      top: '20px',
      right: '20px',
      bottom: '20px',
      left: '20px'
    }
  } = options;

  let browser = null;

  try {
    // Ensure output directory exists
    const fullOutputDir = path.join(__dirname, '..', outputDir);
    if (!fs.existsSync(fullOutputDir)) {
      fs.mkdirSync(fullOutputDir, { recursive: true });
      logger.info(`Created PDF output directory: ${fullOutputDir}`);
    }

    // Generate unique filename if not provided
    const pdfFilename = filename || `report-${Date.now()}.pdf`;
    const pdfPath = path.join(fullOutputDir, pdfFilename);

    logger.info(`Starting PDF generation: ${pdfFilename}`);

    // Launch puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Set content with proper encoding
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF
    await page.pdf({
      path: pdfPath,
      format: format,
      printBackground: includeBackground,
      margin: margin,
      preferCSSPageSize: false
    });

    await browser.close();
    browser = null;

    const stats = fs.statSync(pdfPath);
    const relativePath = `/${outputDir}/${pdfFilename}`;

    logger.info(`PDF generated successfully: ${pdfFilename} (${stats.size} bytes)`);

    return {
      success: true,
      filename: pdfFilename,
      path: pdfPath,
      relativePath: relativePath,
      size: stats.size,
      url: relativePath
    };

  } catch (error) {
    logger.error('Error generating PDF:', error);
    
    // Clean up browser if still open
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        logger.error('Error closing browser:', closeError);
      }
    }

    throw new Error(`PDF generation failed: ${error.message}`);
  }
};

/**
 * Generate report PDF with professional formatting
 * @param {Object} reportData - Report data
 * @returns {Promise<Object>} - PDF file information
 */
const generateReportPDF = async (reportData) => {
  const {
    studentName,
    teacherName,
    reportTitle,
    reportContent,
    reportDate,
    schoolName,
    schoolLogo,
    reportId,
    schoolBranding
  } = reportData;

  // Extract branding colors with fallbacks
  const primaryColor = schoolBranding?.primaryColor || '#667eea';
  const secondaryColor = schoolBranding?.secondaryColor || '#dc004e';
  const accentColor = schoolBranding?.accentColor || '#10b981';
  
  // Helper function to convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '102, 126, 234';
  };

  // Convert logo to base64 for embedding in PDF
  let logoBase64 = null;
  if (schoolLogo) {
    try {
      // Handle both URL and file path formats
      let logoPath = schoolLogo;
      
      // If it's a URL (http://...), extract the path part
      if (schoolLogo.startsWith('http://') || schoolLogo.startsWith('https://')) {
        const url = new URL(schoolLogo);
        logoPath = url.pathname; // Extract path like "/uploads/logos/logo.png"
      }
      
      // Remove leading slash if present and construct full path
      logoPath = logoPath.startsWith('/') ? logoPath.slice(1) : logoPath;
      const fullLogoPath = path.join(__dirname, '..', logoPath);
      
      if (fs.existsSync(fullLogoPath)) {
        const logoData = fs.readFileSync(fullLogoPath);
        const logoExt = path.extname(fullLogoPath).toLowerCase();
        const mimeType = logoExt === '.png' ? 'image/png' : logoExt === '.jpg' || logoExt === '.jpeg' ? 'image/jpeg' : 'image/png';
        logoBase64 = `data:${mimeType};base64,${logoData.toString('base64')}`;
        logger.info(`Logo loaded successfully for PDF: ${fullLogoPath}`);
      } else {
        logger.warn(`Logo file not found: ${fullLogoPath}`);
      }
    } catch (error) {
      logger.warn(`Error loading logo for PDF: ${error.message}`);
    }
  }

  // Create professional HTML template for PDF with modern, colorful design
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Comic Sans MS', 'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif;
          line-height: 1.5;
          color: #2d3748;
          padding: 15px;
          background: linear-gradient(135deg, #f5f7fa 0%, #e8f4f8 100%);
        }
        
        .container {
          background: white;
          border-radius: 15px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        
        .header {
          text-align: center;
          padding: 20px 15px;
          background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
          color: white;
          position: relative;
          overflow: hidden;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 300px;
          height: 300px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }
        
        .header::after {
          content: '';
          position: absolute;
          bottom: -30%;
          left: -10%;
          width: 200px;
          height: 200px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }
        
        .logo {
          max-height: 60px;
          max-width: 200px;
          margin-bottom: 10px;
          object-fit: contain;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.2));
          position: relative;
          z-index: 1;
        }
        
        .school-name {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 5px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 1;
        }
        
        .report-title {
          font-size: 24px;
          font-weight: bold;
          margin: 8px 0;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .report-title::before {
          content: '📊';
          font-size: 26px;
        }
        
        .report-meta {
          background: linear-gradient(135deg, #fff5f7 0%, #fffef5 100%);
          padding: 15px 20px;
          border-radius: 12px;
          margin: 15px 20px;
          border: 2px solid ${primaryColor};
          box-shadow: 0 3px 12px rgba(0,0,0,0.08);
        }
        
        .meta-item {
          display: flex;
          margin-bottom: 8px;
          font-size: 13px;
          align-items: center;
        }
        
        .meta-item:last-child {
          margin-bottom: 0;
        }
        
        .meta-item::before {
          content: '•';
          color: ${secondaryColor};
          font-size: 18px;
          margin-right: 10px;
          font-weight: bold;
        }
        
        .meta-label {
          font-weight: bold;
          color: ${primaryColor};
          width: 120px;
          flex-shrink: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .meta-value {
          color: #2d3748;
          font-weight: 600;
        }
        
        .content-section {
          margin: 15px 20px;
          padding: 18px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: white;
          background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
          padding: 8px 16px;
          border-radius: 8px;
          margin-bottom: 15px;
          display: inline-block;
          box-shadow: 0 3px 8px rgba(0,0,0,0.15);
        }
        
        .report-content {
          font-size: 13px;
          line-height: 1.7;
          color: #2d3748;
          padding: 15px;
          background: #ffffff;
          border-radius: 10px;
        }
        
        .report-content h1 {
          font-size: 18px;
          font-weight: bold;
          color: white;
          background: linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%);
          padding: 8px 15px;
          border-radius: 8px;
          margin: 18px 0 10px 0;
          box-shadow: 0 2px 6px rgba(0,0,0,0.12);
        }
        
        .report-content h2 {
          font-size: 16px;
          font-weight: bold;
          color: ${primaryColor};
          margin: 15px 0 8px 0;
          padding-left: 12px;
          border-left: 4px solid ${secondaryColor};
          background: rgba(${hexToRgb(primaryColor)}, 0.05);
          padding: 6px 6px 6px 12px;
          border-radius: 4px;
        }
        
        .report-content h3 {
          font-size: 14px;
          font-weight: bold;
          color: ${secondaryColor};
          margin: 12px 0 6px 0;
          padding-left: 10px;
          border-left: 3px solid ${primaryColor};
        }
        
        .report-content p {
          margin-bottom: 10px;
          line-height: 1.6;
        }
        
        .report-content strong {
          color: ${primaryColor};
          font-weight: 700;
          background: rgba(${hexToRgb(primaryColor)}, 0.08);
          padding: 1px 4px;
          border-radius: 3px;
        }
        
        .report-content em {
          color: ${secondaryColor};
          font-style: italic;
          font-weight: 600;
        }
        
        .report-content ul, .report-content ol {
          margin-left: 25px;
          margin-bottom: 12px;
        }
        
        .report-content li {
          margin-bottom: 6px;
          line-height: 1.6;
        }
        
        .report-content li::marker {
          color: ${secondaryColor};
          font-weight: bold;
        }
        
        .footer {
          margin: 20px 20px 15px 20px;
          padding: 15px;
          background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%);
          border-radius: 12px;
          text-align: center;
          color: white;
          box-shadow: 0 3px 12px rgba(0,0,0,0.15);
        }
        
        .footer-text {
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 5px;
        }
        
        .footer-tagline {
          font-size: 10px;
          opacity: 0.9;
        }
        
        .footer-note {
          margin-bottom: 10px;
        }
        
        .generated-date {
          font-style: italic;
          color: #a0aec0;
        }
        
        .page-break {
          page-break-after: always;
        }
        
        @media print {
          body {
            padding: 10px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          ${logoBase64 ? `<img src="${logoBase64}" alt="School Logo" class="logo">` : ''}
          <div class="school-name">${schoolName || 'Barrana.ai School'}</div>
          <div class="report-title">Student Report</div>
        </div>
        
        <div class="report-meta">
          <div class="meta-item">
            <span class="meta-label">Report Title:</span>
            <span class="meta-value">${reportTitle}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Student:</span>
            <span class="meta-value">${studentName}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Teacher:</span>
            <span class="meta-value">${teacherName}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Date:</span>
            <span class="meta-value">${reportDate}</span>
          </div>
          ${reportId ? `
          <div class="meta-item">
            <span class="meta-label">Report ID:</span>
            <span class="meta-value">${reportId}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="content-section">
          <div class="section-title">📝 Report Content</div>
          <div class="report-content">
            ${formatReportContentForPDF(reportContent)}
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-text">
            ✨ Generated by ${schoolName || 'Barrana.ai'} School Management System ✨
          </div>
          <div class="footer-tagline">
            Empowering Education Through Technology
          </div>
          <div class="footer-text" style="margin-top: 10px; font-size: 12px;">
            ${new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const filename = `report-${studentName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;

  return await generatePDF({
    html,
    filename,
    outputDir: 'uploads/pdfs',
    includeBackground: true,
    format: 'A4',
    margin: {
      top: '10px',
      right: '10px',
      bottom: '10px',
      left: '10px'
    }
  });
};

/**
 * Format report content for PDF (convert markdown-like formatting to HTML)
 */
function formatReportContentForPDF(content) {
  if (!content) return '<p>No content available.</p>';

  let formatted = content;

  // Convert markdown headings to HTML
  formatted = formatted.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Convert bold text
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert italic text
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Convert line breaks to paragraphs
  formatted = formatted.split('\n\n').map(para => {
    if (para.trim() && !para.trim().startsWith('<')) {
      return `<p>${para.trim()}</p>`;
    }
    return para;
  }).join('\n');

  // Convert single line breaks to <br>
  formatted = formatted.replace(/\n/g, '<br>');

  // Convert unordered lists
  formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
  formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  return formatted;
}

/**
 * Delete PDF file
 * @param {string} pdfPath - Path to PDF file
 */
const deletePDF = async (pdfPath) => {
  try {
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
      logger.info(`Deleted PDF: ${pdfPath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Error deleting PDF:', error);
    return false;
  }
};

/**
 * Clean up old PDF files (older than specified days)
 * @param {number} days - Delete PDFs older than this many days
 */
const cleanupOldPDFs = async (days = 30) => {
  try {
    const pdfDir = path.join(__dirname, '..', 'uploads/pdfs');
    
    if (!fs.existsSync(pdfDir)) {
      return { deleted: 0, message: 'PDF directory does not exist' };
    }

    const files = fs.readdirSync(pdfDir);
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000; // days to milliseconds
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(pdfDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    logger.info(`Cleaned up ${deletedCount} old PDF files`);
    return { deleted: deletedCount, message: `Deleted ${deletedCount} old PDFs` };

  } catch (error) {
    logger.error('Error cleaning up PDFs:', error);
    throw error;
  }
};

module.exports = {
  generatePDF,
  generateReportPDF,
  deletePDF,
  cleanupOldPDFs
};

