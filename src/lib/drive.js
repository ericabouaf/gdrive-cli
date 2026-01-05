import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

// Google Workspace native mimeTypes and their default export formats
const GOOGLE_NATIVE_MIMETYPES = {
  'application/vnd.google-apps.document': {
    defaultExport: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    defaultExt: '.docx'
  },
  'application/vnd.google-apps.spreadsheet': {
    defaultExport: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    defaultExt: '.xlsx'
  },
  'application/vnd.google-apps.presentation': {
    defaultExport: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    defaultExt: '.pptx'
  }
};

// File type aliases for search
const FILE_TYPE_MAP = {
  // Google Workspace types
  'doc': 'application/vnd.google-apps.document',
  'document': 'application/vnd.google-apps.document',
  'sheet': 'application/vnd.google-apps.spreadsheet',
  'spreadsheet': 'application/vnd.google-apps.spreadsheet',
  'slide': 'application/vnd.google-apps.presentation',
  'presentation': 'application/vnd.google-apps.presentation',
  'form': 'application/vnd.google-apps.form',
  'drawing': 'application/vnd.google-apps.drawing',
  'folder': 'application/vnd.google-apps.folder',
  'site': 'application/vnd.google-apps.site',
  // Common file types
  'pdf': 'application/pdf',
  'image': 'image/',
  'video': 'video/',
  'audio': 'audio/',
  'text': 'text/plain',
  'zip': 'application/zip',
  'csv': 'text/csv',
  'json': 'application/json',
  'html': 'text/html',
  'xml': 'application/xml',
  // Microsoft Office
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

// Alternative export formats
const EXPORT_FORMATS = {
  'pdf': 'application/pdf',
  'txt': 'text/plain',
  'html': 'text/html',
  'md': 'text/markdown',
  'csv': 'text/csv',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

/**
 * Get Drive API client
 */
export async function getDriveClient(auth) {
  return google.drive({ version: 'v3', auth });
}

/**
 * Find folder by path
 * @param {object} drive - Drive API client
 * @param {string} folderPath - Path like 'Folder1/Folder2'
 * @returns {string|null} - Folder ID or null if not found
 */
export async function findFolderByPath(drive, folderPath) {
  if (!folderPath || folderPath === '/' || folderPath === '') {
    return 'root';
  }

  const parts = folderPath.split('/').filter(p => p);
  let parentId = 'root';

  for (const folderName of parts) {
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    if (response.data.files.length === 0) {
      return null;
    }

    parentId = response.data.files[0].id;
  }

  return parentId;
}

/**
 * List files in a directory
 * @param {object} drive - Drive API client
 * @param {string} folderPath - Path to list
 * @returns {Array} - List of files
 */
export async function listFiles(drive, folderPath = '') {
  const folderId = await findFolderByPath(drive, folderPath);

  console.log(`Found folderId: ${folderId}`);

  if (!folderId) {
    throw new Error(`Folder not found: ${folderPath}`);
  }

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
    orderBy: 'name',
    spaces: 'drive'
  });

  return response.data.files;
}

/**
 * Upload a file to Google Drive
 * @param {object} drive - Drive API client
 * @param {string} filePath - Local file path
 * @param {string} targetFolder - Target folder path in Drive
 * @returns {object} - Uploaded file metadata
 */
export async function uploadFile(drive, filePath, targetFolder = '') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const folderId = await findFolderByPath(drive, targetFolder);

  if (!folderId) {
    throw new Error(`Target folder not found: ${targetFolder}`);
  }

  const fileName = path.basename(filePath);
  const mimeType = mime.lookup(filePath) || 'application/octet-stream';

  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  };

  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath)
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, webViewLink, size'
  });

  return response.data;
}

/**
 * Download a file from Google Drive
 * @param {object} drive - Drive API client
 * @param {string} driveFilePath - Path in Drive (e.g., 'Folder/file.txt')
 * @param {string} localFilePath - Local destination path
 */
export async function downloadFile(drive, driveFilePath, localFilePath) {
  // Split path into folder and filename
  const parts = driveFilePath.split('/').filter(p => p);
  const fileName = parts.pop();
  const folderPath = parts.join('/');

  // Find the folder
  const folderId = await findFolderByPath(drive, folderPath);

  if (!folderId) {
    throw new Error(`Folder not found: ${folderPath}`);
  }

  // Find the file
  const response = await drive.files.list({
    q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, mimeType)',
    spaces: 'drive'
  });

  if (response.data.files.length === 0) {
    throw new Error(`File not found: ${driveFilePath}`);
  }

  const file = response.data.files[0];

  // Download the file
  const dest = fs.createWriteStream(localFilePath);

  const fileResponse = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    fileResponse.data
      .on('end', () => {
        resolve(file);
      })
      .on('error', err => {
        reject(err);
      })
      .pipe(dest);
  });
}

/**
 * Download a file by its Google Drive ID
 * @param {object} drive - Drive API client
 * @param {string} fileId - Google Drive file ID
 * @param {string} localFilePath - Local destination path
 * @param {string} [format] - Optional export format (pdf, txt, html, csv, docx, xlsx, pptx)
 * @returns {object} - File metadata with download info
 */
export async function downloadFileById(drive, fileId, localFilePath, format = null) {
  // Get file metadata to determine mimeType
  const metadataResponse = await drive.files.get({
    fileId: fileId,
    fields: 'id, name, mimeType, size'
  });

  const file = metadataResponse.data;
  const isGoogleNative = GOOGLE_NATIVE_MIMETYPES.hasOwnProperty(file.mimeType);

  const dest = fs.createWriteStream(localFilePath);

  let fileResponse;
  let exportMimeType = null;

  if (isGoogleNative) {
    // Google native file - needs export
    if (format) {
      // User specified a format
      exportMimeType = EXPORT_FORMATS[format.toLowerCase()];
      if (!exportMimeType) {
        throw new Error(`Unknown export format: ${format}. Supported formats: ${Object.keys(EXPORT_FORMATS).join(', ')}`);
      }
    } else {
      // Use default export format based on file type
      exportMimeType = GOOGLE_NATIVE_MIMETYPES[file.mimeType].defaultExport;
    }

    fileResponse = await drive.files.export(
      { fileId: fileId, mimeType: exportMimeType },
      { responseType: 'stream' }
    );
  } else {
    // Regular file - direct download
    if (format) {
      console.warn(`Warning: --format option is ignored for non-Google native files`);
    }

    fileResponse = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
  }

  return new Promise((resolve, reject) => {
    fileResponse.data
      .on('end', () => {
        resolve({
          ...file,
          exported: isGoogleNative,
          exportMimeType: exportMimeType
        });
      })
      .on('error', err => {
        reject(err);
      })
      .pipe(dest);
  });
}

/**
 * Escape special characters in query values
 */
function escapeQueryValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Parse date string to RFC 3339 format for API
 */
function parseDate(dateStr) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Use format: YYYY-MM-DD`);
  }
  return date.toISOString();
}

/**
 * Parse size string to bytes (e.g., "10MB" -> 10485760)
 */
function parseSizeToBytes(sizeStr) {
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024
  };

  const match = sizeStr.toUpperCase().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}. Use format like "10MB", "500KB", "1GB"`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] || 'B';

  return Math.floor(value * units[unit]);
}

/**
 * Filter files by size
 */
function filterBySize(files, minSize, maxSize) {
  const minBytes = minSize ? parseSizeToBytes(minSize) : 0;
  const maxBytes = maxSize ? parseSizeToBytes(maxSize) : Infinity;

  return files.filter(file => {
    const size = parseInt(file.size || 0, 10);
    return size >= minBytes && size <= maxBytes;
  });
}

/**
 * Resolve file type alias to MIME type
 */
function resolveMimeType(typeAlias) {
  const normalized = typeAlias.toLowerCase();
  if (FILE_TYPE_MAP[normalized]) {
    return FILE_TYPE_MAP[normalized];
  }
  // If not in map, assume it's a raw MIME type
  if (typeAlias.includes('/')) {
    return typeAlias;
  }
  throw new Error(`Unknown file type: ${typeAlias}. Supported types: ${Object.keys(FILE_TYPE_MAP).join(', ')}`);
}

/**
 * Build Google Drive search query from options
 * @param {object} options - Search options
 * @returns {string} - Google Drive API query string
 */
export function buildSearchQuery(options) {
  const queryParts = [];

  // Default: exclude trashed unless explicitly requested
  if (options.trashed) {
    queryParts.push('trashed=true');
  } else {
    queryParts.push('trashed=false');
  }

  // Name contains
  if (options.name) {
    queryParts.push(`name contains '${escapeQueryValue(options.name)}'`);
  }

  // Full text search (searches content)
  if (options.fullText) {
    queryParts.push(`fullText contains '${escapeQueryValue(options.fullText)}'`);
  }

  // File type
  if (options.type) {
    const mimeType = resolveMimeType(options.type);
    if (mimeType.endsWith('/')) {
      // Prefix match for categories like image/, video/
      queryParts.push(`mimeType contains '${mimeType}'`);
    } else {
      queryParts.push(`mimeType='${mimeType}'`);
    }
  }

  // Parent folder
  if (options.parent) {
    queryParts.push(`'${options.parent}' in parents`);
  }

  // Date filters
  if (options.after) {
    const date = parseDate(options.after);
    queryParts.push(`modifiedTime>'${date}'`);
  }
  if (options.before) {
    const date = parseDate(options.before);
    queryParts.push(`modifiedTime<'${date}'`);
  }

  // Owner filter
  if (options.owner) {
    queryParts.push(`'${escapeQueryValue(options.owner)}' in owners`);
  }

  // Starred
  if (options.starred) {
    queryParts.push('starred=true');
  }

  // Sharing filters
  if (options.sharedWithMe) {
    queryParts.push('sharedWithMe=true');
  }

  return queryParts.join(' and ');
}

/**
 * Search files in Google Drive
 * @param {object} drive - Drive API client
 * @param {object} options - Search options
 * @returns {Array} - List of matching files
 */
export async function searchFiles(drive, options) {
  const query = buildSearchQuery(options);
  const limit = options.limit || 50;
  const orderBy = options.orderBy || 'modifiedTime desc';

  let allFiles = [];
  let pageToken = null;

  do {
    const response = await drive.files.list({
      q: query,
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, owners, starred, shared)',
      orderBy: orderBy,
      pageSize: Math.min(limit - allFiles.length, 100),
      pageToken: pageToken,
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    allFiles = allFiles.concat(response.data.files);
    pageToken = response.data.nextPageToken;

  } while (pageToken && allFiles.length < limit);

  // Post-process for size filtering (API doesn't support size queries)
  if (options.minSize || options.maxSize) {
    allFiles = filterBySize(allFiles, options.minSize, options.maxSize);
  }

  return allFiles.slice(0, limit);
}

/**
 * Format file size
 */
export function formatSize(bytes) {
  if (!bytes) return 'N/A';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format date
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}
