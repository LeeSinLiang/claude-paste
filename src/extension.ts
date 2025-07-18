import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const COMMAND_TIMEOUT = 10000;

function getPlatform(): string | null {
	if (process.platform === 'win32') {
		return 'windows';
	}
	
	if (process.platform === 'linux' && fs.existsSync('/mnt/c/Windows')) {
		return 'wsl';
	}
	
	return null;
}

async function getImageFromClipboard(platform: string): Promise<string> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		throw new Error('No workspace folder is open');
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const tempDir = path.join(workspaceRoot, '.temp');
	await fs.ensureDir(tempDir);

	// Convert WSL path to Windows path for PowerShell
	let windowsTempDir = tempDir;
	if (platform === 'wsl') {
		const { stdout } = await execAsync(`wslpath -w "${tempDir}"`);
		windowsTempDir = stdout.trim();
	}

	const psScript = `
$ErrorActionPreference = 'Stop'

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
} catch {
    Write-Error "Failed to load required .NET assemblies"
    exit 1
}

$files = [System.Windows.Forms.Clipboard]::GetFileDropList()
if ($files -and $files.Count -gt 0) {
    $sourceFile = $files[0]
    
    if (-not (Test-Path $sourceFile)) {
        Write-Error "Source file not found: $sourceFile"
        exit 1
    }
    
    $imageExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif')
    $extension = [System.IO.Path]::GetExtension($sourceFile).ToLower()
    
    if ($imageExtensions -contains $extension) {
        $dateString = Get-Date -Format "yyyyMMdd_HHmmss"
        $tempPath = "${windowsTempDir.replace(/\\/g, '\\\\')}/clipboard-image-$dateString$extension"
        try {
            Copy-Item -Path $sourceFile -Destination $tempPath -Force -ErrorAction Stop
            Write-Output $tempPath
            exit 0
        } catch {
            Write-Error "Failed to copy file: $_"
            exit 1
        }
    } else {
        Write-Error "Clipboard contains a non-image file: $sourceFile"
        exit 1
    }
}

try {
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($image -eq $null) {
        Write-Error "No image found in clipboard"
        exit 1
    }
    
    $dateString = Get-Date -Format "yyyyMMdd_HHmmss"
    $tempPath = "${windowsTempDir.replace(/\\/g, '\\\\')}/clipboard-image-$dateString.png"
    $image.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $image.Dispose()
    Write-Output $tempPath
} catch {
    Write-Error "Failed to save clipboard image: $_"
    exit 1
}`.trim();

	let command: string;
	if (platform === 'wsl') {
		const escapedScript = psScript
			.replace(/\$/g, '\\$')
			.replace(/"/g, '\\"')
			.replace(/`/g, '\\`');
		command = `powershell.exe -NoProfile -Command "${escapedScript}"`;
	} else {
		const escapedScript = psScript.replace(/"/g, '\\"');
		command = `powershell -NoProfile -Command "${escapedScript}"`;
	}

	const { stdout, stderr } = await execAsync(command, {
		timeout: COMMAND_TIMEOUT
	});
	
	if (stderr) {
		throw new Error(stderr.trim());
	}

	return stdout.trim();
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Claude Paste extension is now active!');

	const disposable = vscode.commands.registerCommand('claude-paste.saveClipboardImage', async () => {
		try {
			const platform = getPlatform();
			if (!platform) {
				vscode.window.showErrorMessage('Only supported on Windows and WSL environments');
				return;
			}

			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: 'Retrieving image from clipboard...',
				cancellable: false
			}, async () => {
				const imagePath = await getImageFromClipboard(platform);
				
				// For WSL, the PowerShell returns a Windows path, but the file is actually in our WSL .temp directory
				let finalPath = imagePath;
				if (platform === 'wsl') {
					// Extract the filename from the Windows path and construct the WSL path
					const filename = path.basename(imagePath);
					const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
					finalPath = path.join(workspaceRoot, '.temp', filename);
				}
				
				const relativePath = vscode.workspace.asRelativePath(finalPath);
				
				const stats = fs.statSync(finalPath);
				const sizeKB = Math.round(stats.size / 1024);
				
				vscode.window.showInformationMessage(
					`Image saved to: ${relativePath} (${sizeKB}KB)`,
					'Copy Path'
				).then(selection => {
					if (selection === 'Copy Path') {
						vscode.env.clipboard.writeText(relativePath);
					}
				});
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save clipboard image: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
