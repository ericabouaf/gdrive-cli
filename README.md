# Google Drive CLI

A command-line interface for Google Drive.

## Features

- 🔐 OAuth2 authentication
- 👥 Multi-profile support (multiple Gdrive accounts)
- 📤 Upload files to Google Drive
- 📥 Download files from Google Drive (by path or ID)
- 📄 Export Google Docs/Sheets/Slides to various formats
- 📂 List files and folders
- 🎨 Beautiful colored output with chalk
- ⚡ Loading spinners with ora

## Installation

Install globally to use the `gdrive` command anywhere:

```bash
npm install -g gdrive-cli
```

## Configuration


### 1. Get Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing one)
3. Enable Drive API
4. Create OAuth 2.0 credentials (Desktop app)
5. Download credentials as JSON


### 2. Set up configuration

Create config directory:

```bash
mkdir -p ~/.config/gdrive
```

Create `~/.config/gdrive/config.json`:

```json
{
  "profiles": {
    "default": {
      "GDRIVE_OAUTH_PATH": "/path/to/client_secret_xxx.json"
    }
  }
}
```

Where `GDRIVE_OAUTH_PATH` points to the OAuth client credentials JSON file you downloaded from Google Cloud Console (contains `client_id`, `client_secret`, etc.).

#### Multiple profiles

You can configure multiple Gdrive accounts by adding more profiles:

```json
{
  "profiles": {
    "default": {
      "GDRIVE_OAUTH_PATH": "/path/to/personal_client_secret.json"
    },
    "work": {
      "GDRIVE_OAUTH_PATH": "/path/to/work_client_secret.json"
    }
  }
}
```

Each profile can use a different Google Cloud OAuth app, allowing complete separation between accounts.


### 3. Authenticate

```bash
gdrive auth login
```

This will:
- Open your browser for authorization
- Start a local server to capture the OAuth callback
- Save the token to `~/.config/gdrive/{profile}.token.json`

For other profiles, use the `--profile` option:

```bash
gdrive --profile work auth login
```

## Usage

### Global Options

```bash
--profile <name>   Profile to use (default: "default")
--version          Show version number
--help             Show help
```

All commands support the `--profile` option:

```bash
gdrive --profile work email search "is:unread"
gdrive --profile work auth status
```

### Authentication

```bash
# Login
gdrive auth login

# Check authentication status
gdrive auth status

# Logout
gdrive auth logout
```

### File Management

#### Upload files

```bash
# Upload to root directory
gdrive file upload ./report.pdf

# Upload to specific folder
gdrive file upload ./report.pdf "Work/Reports"

# Upload with JSON output
gdrive file upload ./data.csv "Data" --json
```

#### List files

```bash
# List root directory
gdrive file ls

# List specific folder
gdrive file ls "Work/Reports"

# List with JSON output
gdrive file ls "Documents" --json
```

#### Download files by path

```bash
# Download file from root
gdrive file get "report.pdf" "./local-report.pdf"

# Download file from folder
gdrive file get "Work/Reports/Q1.pdf" "./Q1-report.pdf"

# Download with JSON output
gdrive file get "data.csv" "./data.csv" --json
```

#### Export files by ID

Use `export` when you have the Google Drive file ID (useful for shared links or API integrations).

```bash
# Download a regular file (PDF, image, etc.)
gdrive file export 1v4wlXvI_i8BCJZtBlxjHi3YJyOfebZGuqevq8cGcG2k ./output.pdf
```

**Google Workspace files** (Docs, Sheets, Slides) are automatically exported to their Office equivalent:

| Google Format | Default Export |
|---------------|----------------|
| Google Docs   | `.docx`        |
| Google Sheets | `.xlsx`        |
| Google Slides | `.pptx`        |

```bash
# Export a Google Doc to docx (automatic)
gdrive file export 1abc123def456 ./document.docx

# Export a Google Sheet to xlsx (automatic)
gdrive file export 1xyz789ghi012 ./spreadsheet.xlsx
```

**Custom export formats** with `--format`:

```bash
# Export Google Doc as PDF
gdrive file export 1abc123def456 ./document.pdf --format pdf

# Export Google Doc as plain text
gdrive file export 1abc123def456 ./document.txt --format txt

# Export Google Doc as HTML
gdrive file export 1abc123def456 ./document.html --format html

# Export Google Doc as Markdown
gdrive file export 1abc123def456 ./document.md --format md

# Export Google Sheet as CSV
gdrive file export 1xyz789ghi012 ./data.csv --format csv

# Export Google Sheet as PDF
gdrive file export 1xyz789ghi012 ./spreadsheet.pdf --format pdf
```

**Supported export formats:**

| Format | MIME Type | Best for |
|--------|-----------|----------|
| `pdf`  | application/pdf | Universal sharing |
| `docx` | Word document | Google Docs |
| `xlsx` | Excel spreadsheet | Google Sheets |
| `pptx` | PowerPoint presentation | Google Slides |
| `txt`  | Plain text | Google Docs |
| `md`   | Markdown | Google Docs |
| `html` | HTML | Google Docs |
| `csv`  | CSV | Google Sheets |

## Examples

### Complete Upload Workflow

```bash
# Step 1: Check authentication
gdrive auth status

# Step 2: List target directory to verify it exists
gdrive file ls "Work"

# Step 3: Upload the file
gdrive file upload ./report.pdf "Work/Reports"
```

### Complete Download Workflow

```bash
# Step 1: List directory to find the file
gdrive file ls "Work/Reports"

# Step 2: Download the file
gdrive file get "Work/Reports/Q1.pdf" "./Q1.pdf"
```

### Export by ID Workflow

```bash
# Step 1: List directory to get the file ID
gdrive file ls "Documents" --json | jq '.[] | {name, id}'

# Step 2: Export using the ID
gdrive file export 1abc123def456 ./document.docx

# Or export a Google Doc to PDF
gdrive file export 1abc123def456 ./document.pdf --format pdf
```

### Organize Files by Project

```bash
# Create organization by uploading to specific folders
gdrive file upload ./design.pdf "Projects/WebApp/Design"
gdrive file upload ./code.zip "Projects/WebApp/Code"
gdrive file upload ./report.pdf "Projects/WebApp/Reports"

# List all files in project
gdrive file ls "Projects/WebApp"
```

## Output Formats

Most commands support the `--json` flag for machine-readable output:

```bash
# Get JSON output for upload
gdrive file upload ./file.pdf --json | jq '.id'

# Get JSON output for file listing
gdrive file ls --json | jq '.[] | .name'
```

## Technical Details

### Dependencies

- `commander` - CLI framework
- `googleapis` - Google APIs client library
- `google-auth-library` - OAuth2 authentication
- `mime-types` - MIME type detection for file uploads
- `chalk` - Colored terminal output
- `ora` - Loading spinners
- `open` - Open browser for OAuth flow

### Google Drive API Scopes

The CLI requires the following scopes:
- `https://www.googleapis.com/auth/drive` - 
- `https://www.googleapis.com/auth/drive.file` - Create and modify files

### File Path Format

File paths in Google Drive are specified using forward slashes:
- Root directory: `""` (empty string) or omit the parameter
- Subfolder: `"Work/Reports"`
- File in subfolder: `"Work/Reports/Q1.pdf"`

### Limitations

- Files larger than 5TB cannot be uploaded (Google Drive API limit)
- Folder paths must exist before uploading (folders are not created automatically)
- Downloaded files overwrite existing local files without warning
- Google Workspace files (Docs, Sheets, Slides) can only be downloaded via `export` (not `get`)
- Export size limits apply to Google Workspace files (10MB for most exports, 100 sheets for spreadsheets)

## Troubleshooting

### Authentication errors

```bash
# Check authentication status
gdrive auth status

# Re-authenticate if needed
gdrive auth login
```

### "Configuration file not found"

Create the configuration file:

```bash
mkdir -p ~/.config/gdrive
nano ~/.config/gdrive/config
```

Add your credentials path:
```
GDRIVE_OAUTH_PATH=/path/to/oauth.keys.json
```

### "File not found" errors

For local files:
```bash
# Use absolute paths or verify relative paths
gdrive file upload /absolute/path/to/file.pdf
gdrive file upload ./relative/path/to/file.pdf
```

For Google Drive files:
```bash
# List the directory first to see available files
gdrive file ls "Work/Reports"

# Then download with the correct path
gdrive file get "Work/Reports/Q1.pdf" "./Q1.pdf"
```

### "Folder not found"

List parent folders to verify the path:

```bash
# Check root directory
gdrive file ls

# Check subdirectory
gdrive file ls "Work"
```

## License

MIT
