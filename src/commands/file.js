import { Command } from 'commander';
import { getAuthClient } from '../lib/auth.js';
import { getDriveClient, uploadFile, listFiles, downloadFile, downloadFileById, formatSize, formatDate } from '../lib/drive.js';
import chalk from 'chalk';
import ora from 'ora';

export const fileCommand = new Command('file')
  .description('Manage files in Google Drive');

// Upload command
fileCommand
  .command('upload')
  .description('Upload a file to Google Drive')
  .argument('<file>', 'Local file path to upload')
  .argument('[targetDirectory]', 'Target directory in Drive (default: root)', '')
  .option('--json', 'Output in JSON format')
  .action(async (file, targetDirectory, options) => {
    try {
      const spinner = ora('Uploading file...').start();

      const auth = await getAuthClient();
      const drive = await getDriveClient(auth);

      const result = await uploadFile(drive, file, targetDirectory);

      spinner.succeed('File uploaded successfully');

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.bold('\nFile Details:'));
        console.log(`Name: ${result.name}`);
        console.log(`ID: ${result.id}`);
        console.log(`Size: ${formatSize(result.size)}`);
        console.log(`Link: ${result.webViewLink}`);
      }
    } catch (error) {
      if (error.message.includes('File not found')) {
        console.error(chalk.red('Error:'), 'Local file not found');
      } else if (error.message.includes('Target folder not found')) {
        console.error(chalk.red('Error:'), 'Target directory not found in Google Drive');
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// List command (ls)
fileCommand
  .command('ls')
  .description('List files in a Google Drive directory')
  .argument('[driveDirectory]', 'Directory path in Drive (default: root)', '')
  .option('--json', 'Output in JSON format')
  .action(async (driveDirectory, options) => {
    try {
      const spinner = ora('Fetching files...').start();

      const auth = await getAuthClient();
      const drive = await getDriveClient(auth);

      const files = await listFiles(drive, driveDirectory);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(files, null, 2));
      } else {
        if (files.length === 0) {
          console.log(chalk.yellow('No files found'));
          return;
        }

        console.log(chalk.bold(`\nFiles in ${driveDirectory || 'root'}:\n`));

        files.forEach(file => {
          const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
          const icon = isFolder ? '📁' : '📄';
          const size = isFolder ? '' : ` (${formatSize(file.size)})`;

          console.log(`${icon} ${chalk.bold(file.name)}${size}`);
          console.log(`   ID: ${file.id}`);
          console.log(`   Modified: ${formatDate(file.modifiedTime)}`);
          console.log(`   Link: ${file.webViewLink}`);
          console.log();
        });

        console.log(chalk.gray(`Total: ${files.length} item(s)`));
      }
    } catch (error) {
      if (error.message.includes('Folder not found')) {
        console.error(chalk.red('Error:'), 'Directory not found in Google Drive');
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Get/Download command
fileCommand
  .command('get')
  .description('Download a file from Google Drive')
  .argument('<gdriveFilePath>', 'File path in Drive (e.g., "Folder/file.txt")')
  .argument('<localFilePath>', 'Local destination path')
  .option('--json', 'Output in JSON format')
  .action(async (gdriveFilePath, localFilePath, options) => {
    try {
      const spinner = ora('Downloading file...').start();

      const auth = await getAuthClient();
      const drive = await getDriveClient(auth);

      const file = await downloadFile(drive, gdriveFilePath, localFilePath);

      spinner.succeed('File downloaded successfully');

      if (options.json) {
        console.log(JSON.stringify({
          name: file.name,
          id: file.id,
          localPath: localFilePath
        }, null, 2));
      } else {
        console.log(chalk.bold('\nDownload Complete:'));
        console.log(`File: ${file.name}`);
        console.log(`Saved to: ${localFilePath}`);
      }
    } catch (error) {
      if (error.message.includes('not found')) {
        console.error(chalk.red('Error:'), 'File or folder not found in Google Drive');
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });

// Export command (download by ID)
fileCommand
  .command('export')
  .description('Export/download a file from Google Drive by its ID')
  .argument('<fileId>', 'Google Drive file ID')
  .argument('<localPath>', 'Local destination path')
  .option('--format <format>', 'Export format for Google Docs (pdf, txt, html, md, csv, docx, xlsx, pptx)')
  .option('--json', 'Output in JSON format')
  .action(async (fileId, localPath, options) => {
    try {
      const spinner = ora('Downloading file...').start();

      const auth = await getAuthClient();
      const drive = await getDriveClient(auth);

      const file = await downloadFileById(drive, fileId, localPath, options.format);

      spinner.succeed('File downloaded successfully');

      if (options.json) {
        console.log(JSON.stringify({
          name: file.name,
          id: file.id,
          mimeType: file.mimeType,
          localPath: localPath,
          exported: file.exported,
          exportMimeType: file.exportMimeType
        }, null, 2));
      } else {
        console.log(chalk.bold('\nDownload Complete:'));
        console.log(`File: ${file.name}`);
        console.log(`ID: ${file.id}`);
        console.log(`Saved to: ${localPath}`);
        if (file.exported) {
          console.log(`Exported as: ${file.exportMimeType}`);
        }
      }
    } catch (error) {
      if (error.code === 404 || error.message.includes('not found')) {
        console.error(chalk.red('Error:'), 'File not found in Google Drive');
      } else if (error.message.includes('Unknown export format')) {
        console.error(chalk.red('Error:'), error.message);
      } else {
        console.error(chalk.red('Error:'), error.message);
      }
      process.exit(1);
    }
  });
