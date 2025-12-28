import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

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
