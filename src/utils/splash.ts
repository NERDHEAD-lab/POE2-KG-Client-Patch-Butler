
import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import { getBinDirectory } from './config.js';
import { logger } from './logger.js';
import { 
    SPLASH_LOGO_BASE64
} from '../generated/splashAssets.js';

let splashProcess: ChildProcess | null = null;
const SPLASH_SCRIPT_NAME = 'splash.ps1';

// We will write assets to the bin directory (temp/cache location)
// This ensures they are available regardless of install mode.

const getSplashScriptContent = () => `param([string]$assetsDir)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    Add-Type -AssemblyName PresentationCore,PresentationFramework,WindowsBase

    # Helper to load image
    function Get-ImageSource {
        param($fileName)
        try {
            $path = Join-Path $assetsDir $fileName
            if (Test-Path $path) {
                $img = New-Object System.Windows.Media.Imaging.BitmapImage
                $img.BeginInit()
                $img.UriSource = $path
                $img.CacheOption = "OnLoad"
                $img.EndInit()
                return $img
            }
        } catch {}
        return $null
    }

    # --- XAML Definition ---
    [xml]$xaml = @"
    <Window 
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="POE2 Patch Butler Splash" 
        WindowStyle="None" 
        AllowsTransparency="True" 
        Background="#0F0F0F"
        Topmost="True"
        Width="385" Height="240"
        ShowInTaskbar="False"
        ResizeMode="NoResize">
        <Border BorderThickness="1" BorderBrush="#333333">
            <StackPanel VerticalAlignment="Top" HorizontalAlignment="Center" Margin="0,0,0,0">
                <!-- Logo -->
                <Image Name="Logo" Width="250" Stretch="Uniform" Margin="0,-15,0,5" />
                
                <!-- Loading Text -->
                <TextBlock Name="LoadingText" 
                           Text="게임을 로딩중입니다" 
                           Foreground="White" 
                           FontSize="18" 
                           FontWeight="Bold"
                           HorizontalAlignment="Center" 
                           TextAlignment="Center"
                           Opacity="0.9" />
            </StackPanel>
        </Border>
    </Window>
"@

    $reader = (New-Object System.Xml.XmlNodeReader $xaml)
    $window = [Windows.Markup.XamlReader]::Load($reader)

    # --- Bind Images ---
    $imgLogo = $window.FindName("Logo")
    $imgLogo.Source = Get-ImageSource "logo.png"

    # --- Loading Animation Timer & File Watcher ---
    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(500)
    $script:dotCount = 0
    $statusFile = Join-Path $assetsDir "splash_status.txt"
    
    $updateAction = {
        # Check Status File
        if (Test-Path $statusFile) {
            $status = Get-Content $statusFile -Raw
            if ($status -and $status.Trim() -eq "DONE") {
                $txt = $window.FindName("LoadingText")
                $txt.Text = "로딩이 완료되었습니다!"
                $txt.Foreground = "#4CAF50" # Green
                
                $timer.Stop()
                
                # Close after 1 second
                $closeTimer = New-Object System.Windows.Threading.DispatcherTimer
                $closeTimer.Interval = [TimeSpan]::FromSeconds(1)
                $closeTimer.Add_Tick({ $window.Close() })
                $closeTimer.Start()
                return
            }
        }

        # Animation
        $script:dotCount = ($script:dotCount + 1) % 4
        $dots = "." * $script:dotCount
        $txt = $window.FindName("LoadingText")
        $txt.Text = "게임을 로딩중입니다$dots"
    }
    
    $timer.Add_Tick($updateAction)
    $timer.Start()

    # --- Position Bottom Right ---
    $screenWidth = [System.Windows.SystemParameters]::PrimaryScreenWidth
    $screenHeight = [System.Windows.SystemParameters]::PrimaryScreenHeight
    $window.Left = $screenWidth - $window.Width - 20
    $window.Top = $screenHeight - $window.Height - 60 

    # Force Activate
    $window.Show()
    $window.Activate()
    $window.Focus()
    $window.Topmost = $true
    
    # Message Loop
    $app = New-Object System.Windows.Application
    $app.Run($window) | Out-Null
} catch {
    $errFile = Join-Path $assetsDir "splash_debug.log"
    $_.Exception.ToString() | Out-File -FilePath $errFile
}
`;

function writeAsset(dir: string, filename: string, base64: string) {
    const filePath = join(dir, filename);
    try {
        writeFileSync(filePath, Buffer.from(base64, 'base64'));
    } catch (e) {
        logger.error(`Failed to write asset ${filename}: ${e}`);
    }
}

export async function showSplash() {
    if (splashProcess) return;

    // Check if enabled
    if (!(await isSplashEnabled())) {
        return;
    }

    const binDir = getBinDirectory();
    const scriptPath = join(binDir, SPLASH_SCRIPT_NAME);

    // Clean status file (Reset state)
    const statusFile = join(binDir, 'splash_status.txt');
    try {
        if (existsSync(statusFile)) {
            writeFileSync(statusFile, '');
        }
    } catch (e) {}

    // Ensure Script Exists (Sanity Check)
    if (!existsSync(scriptPath)) {
        // If script is missing but enabled, re-generate it
        try {
            writeAsset(binDir, 'logo.png', SPLASH_LOGO_BASE64);
            writeFileSync(scriptPath, '\uFEFF' + getSplashScriptContent(), { encoding: 'utf16le' });
        } catch (e) {
            return;
        }
    }

    logger.info('스플래시 스크린을 표시합니다 (Debug Mode)...');
    
    splashProcess = spawn('powershell', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        '-assetsDir', binDir 
    ], {
        stdio: ['ignore', 'pipe', 'pipe'], 
        windowsHide: true
    });

    if (splashProcess.stdout) {
        splashProcess.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logger.info(`[Splash/STDOUT] ${msg}`);
        });
    }

    if (splashProcess.stderr) {
        splashProcess.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg) logger.error(`[Splash/STDERR] ${msg}`);
        });
    }

    splashProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
            logger.warn(`스플래시 프로세스가 종료되었습니다 (Code: ${code})`);
        }
        splashProcess = null;
    });
}

export function completeSplash() {
    if (splashProcess) {
        logger.info('스플래시 스크린 완료 신호 전송...');
        const binDir = getBinDirectory();
        const statusFile = join(binDir, 'splash_status.txt');
        try {
            writeFileSync(statusFile, 'DONE');
        } catch (e) {
            logger.error(`Failed to write splash status: ${e}`);
        }
    }
}

export function hideSplash() {
    if (splashProcess) {
        logger.info('스플래시 스크린을 숨깁니다.');
        try {
            splashProcess.kill();
        } catch (_error) { /* ignore */ }
        splashProcess = null;
    }
}

// --- Toggle Feature ---
const SPLASH_ENABLED_FILE = 'splash_enabled.txt';

export async function isSplashEnabled(): Promise<boolean> {
    const binDir = getBinDirectory();
    const filePath = join(binDir, SPLASH_ENABLED_FILE);
    try {
        return existsSync(filePath);
    } catch (e) {
        return false;
    }
}

export async function enableSplash(): Promise<boolean> {
    const binDir = getBinDirectory();
    const filePath = join(binDir, SPLASH_ENABLED_FILE);
    try {
        // 1. Mark as Enabled
        writeFileSync(filePath, 'ENABLED');
        
        // 2. Write Assets (Pre-load)
        // Logo
        writeAsset(binDir, 'logo.png', SPLASH_LOGO_BASE64);
        
        // Script
        const scriptPath = join(binDir, SPLASH_SCRIPT_NAME);
        writeFileSync(scriptPath, '\uFEFF' + getSplashScriptContent(), { encoding: 'utf16le' });

        return true;
    } catch (e) {
        logger.error(`Failed to enable splash: ${e}`);
        return false;
    }
}

export async function disableSplash(): Promise<boolean> {
    const binDir = getBinDirectory();
    
    // Files to clean up
    const filesToDelete = [
        SPLASH_ENABLED_FILE,
        'logo.png',
        SPLASH_SCRIPT_NAME,
        'splash_status.txt',
        'splash_debug.log'
    ];

    try {
        const { unlinkSync } = await import('node:fs');
        
        for (const file of filesToDelete) {
            const path = join(binDir, file);
            if (existsSync(path)) {
                unlinkSync(path);
            }
        }
        
        return true;
    } catch (e) {
        logger.error(`Failed to disable splash: ${e}`);
        return false;
    }
}
