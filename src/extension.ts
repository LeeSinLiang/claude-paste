import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const COMMAND_TIMEOUT = 10000;

async function getLinuxSessionType(): Promise<'x11' | 'wayland' | 'unknown'> {
	try {
		// Method 1: Check XDG_SESSION_TYPE environment variable
		if (process.env.XDG_SESSION_TYPE) {
			const sessionType = process.env.XDG_SESSION_TYPE.toLowerCase();
			if (sessionType === 'wayland') {
				return 'wayland';
			}
			if (sessionType === 'x11') {
				return 'x11';
			}
		}

		// Method 2: Check WAYLAND_DISPLAY variable
		if (process.env.WAYLAND_DISPLAY) {
			return 'wayland';
		}

		// Method 3: Check DISPLAY variable (indicates X11)
		if (process.env.DISPLAY) {
			return 'x11';
		}

		// Method 4: Use loginctl as fallback
		try {
			const { stdout } = await execAsync('loginctl show-session $(loginctl | grep "$(whoami)" | awk \'{print $1}\') -p Type', { timeout: 3000 });
			if (stdout.includes('wayland')) {
				return 'wayland';
			}
			if (stdout.includes('x11')) {
				return 'x11';
			}
		} catch {
			// loginctl failed, continue to unknown
		}

		return 'unknown';
	} catch {
		return 'unknown';
	}
}

async function checkLinuxClipboardHasImage(): Promise<boolean> {
	const sessionType = await getLinuxSessionType();
	
	try {
		if (sessionType === 'wayland') {
			// Check if wl-paste has image data
			const { stdout } = await execAsync('wl-paste --list-types', { timeout: 3000 });
			return stdout.includes('image/');
		} else if (sessionType === 'x11') {
			// Check if xclip has image data
			const { stdout } = await execAsync('xclip -selection clipboard -t TARGETS -o', { timeout: 3000 });
			return stdout.includes('image/');
		}
		return false;
	} catch {
		return false;
	}
}

async function saveImageLinux(filepath: string): Promise<string> {
	const sessionType = await getLinuxSessionType();
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
	const milliseconds = new Date().getMilliseconds().toString().padStart(3, '0');
	const filename = `clipboard-image-${timestamp}_${milliseconds}.png`;
	const fullPath = path.join(path.dirname(filepath), filename);

	try {
		if (sessionType === 'wayland') {
			// Try wl-paste
			await execAsync(`wl-paste -t image/png > "${fullPath}"`, { timeout: COMMAND_TIMEOUT });
		} else if (sessionType === 'x11') {
			// Try xclip
			await execAsync(`xclip -selection clipboard -t image/png -o > "${fullPath}"`, { timeout: COMMAND_TIMEOUT });
		} else {
			throw new Error('Unknown session type. Linux clipboard requires X11 or Wayland.');
		}

		// Validate file was created and has content
		const stats = await fs.stat(fullPath);
		if (stats.size === 0) {
			await fs.remove(fullPath);
			throw new Error('No image in clipboard');
		}

		return fullPath;
	} catch (error: any) {
		// Handle dependency errors
		if (error.message?.includes('command not found')) {
			if (sessionType === 'wayland') {
				throw new Error('wl-clipboard not installed. Run: sudo apt-get install wl-clipboard');
			} else {
				throw new Error('xclip not installed. Run: sudo apt-get install xclip');
			}
		}

		throw new Error(`Failed to save clipboard image: ${error.message || String(error)}`);
	}
}

async function checkClipboardHasImage(platform: string): Promise<boolean> {
	if (platform === 'linux') {
		return await checkLinuxClipboardHasImage();
	}
	const psScript = `
try {
    Add-Type -AssemblyName System.Windows.Forms
    $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
    if ($files -and $files.Count -gt 0) {
        $sourceFile = $files[0]
        $imageExtensions = @('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif')
        $extension = [System.IO.Path]::GetExtension($sourceFile).ToLower()
        if ($imageExtensions -contains $extension) {
            Write-Output "true"
            exit 0
        }
    }
    
    $image = [System.Windows.Forms.Clipboard]::GetImage()
    if ($image -ne $null) {
        $image.Dispose()
        Write-Output "true"
        exit 0
    }
    
    Write-Output "false"
} catch {
    Write-Output "false"
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

	try {
		const { stdout } = await execAsync(command, { timeout: 5000 });
		return stdout.trim() === 'true';
	} catch {
		return false;
	}
}

function getPlatform(): string | null {
	if (process.platform === 'win32') {
		return 'windows';
	}
	
	if (process.platform === 'linux') {
		if (fs.existsSync('/mnt/c/Windows')) {
			return 'wsl';
		}
		return 'linux';
	}
	
	if (process.platform === 'darwin') {
		return 'macos';
	}
	
	return null;
}

async function getImageFromClipboard(platform: string): Promise<string> {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		throw new Error('No workspace folder is open');
	}

	const workspaceRoot = workspaceFolders[0].uri.fsPath;
	const tempDir = path.join(workspaceRoot, 'temp');
	await fs.ensureDir(tempDir);

	// Handle Linux platform
	if (platform === 'linux') {
		return await saveImageLinux(tempDir);
	}

	// Handle macOS platform  
	if (platform === 'macos') {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
		const milliseconds = new Date().getMilliseconds().toString().padStart(3, '0');
		const filename = `clipboard-image-${timestamp}_${milliseconds}.png`;
		const filepath = path.join(tempDir, filename);
		
		try {
			await execAsync(`pngpaste "${filepath}"`, { timeout: COMMAND_TIMEOUT });
			return filepath;
		} catch (error) {
			throw new Error('No image found in clipboard. Make sure pngpaste is installed: brew install pngpaste');
		}
	}

	// Convert WSL path to Windows path for PowerShell
	let windowsTempDir = tempDir;
	if (platform === 'wsl') {
		const { stdout } = await execAsync(`wslpath -w "${tempDir}"`);
		windowsTempDir = stdout.trim();
	}
	
	// Escape backslashes for PowerShell string interpolation
	const escapedTempDir = windowsTempDir.replace(/\\/g, '\\\\');

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
        $dateString = Get-Date -Format "yyyyMMdd_HHmmss_fff"
        $tempPath = "${escapedTempDir}/clipboard-image-$dateString$extension"
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
    
    $dateString = Get-Date -Format "yyyyMMdd_HHmmss_fff"
    $tempPath = "${escapedTempDir}/clipboard-image-$dateString.png"
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
				vscode.window.showErrorMessage('Only supported on Windows, WSL, macOS, and Linux environments');
				return;
			}

			// Quick check if clipboard contains an image
			const hasImage = await checkClipboardHasImage(platform);
			if (!hasImage) {
				vscode.window.showWarningMessage('No image found in clipboard. Copy an image or image file and try again.');
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
					const workspaceFolders = vscode.workspace.workspaceFolders;
					if (!workspaceFolders) {
						throw new Error('Workspace folder no longer available');
					}
					const workspaceRoot = workspaceFolders[0].uri.fsPath;
					finalPath = path.join(workspaceRoot, 'temp', filename);
				}
				// For Linux and macOS, imagePath is already the correct final path
				
				// Validate file exists and has content
				if (!fs.existsSync(finalPath)) {
					throw new Error('Image file was not created successfully');
				}
				
				const stats = fs.statSync(finalPath);
				if (stats.size === 0) {
					await fs.remove(finalPath);
					throw new Error('Image file is empty');
				}
				
				// Validate reasonable file size (between 1KB and 50MB)
				if (stats.size < 1024) {
					await fs.remove(finalPath);
					throw new Error('Image file is too small (likely corrupted)');
				}
				if (stats.size > 50 * 1024 * 1024) {
					await fs.remove(finalPath);
					throw new Error('Image file is too large (>50MB)');
				}
				
				const relativePath = vscode.workspace.asRelativePath(finalPath);
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
