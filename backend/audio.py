import subprocess
import re
import os
import tempfile
import glob
from typing import Optional, Callable


def download_audio_with_progress(
    url: str,
    quality: str,
    progress_callback: Callable[[float], None],
    cookies: Optional[str] = None
) -> str:
    """
    Download audio as best available format (no conversion = faster)
    
    Args:
        url: Audio URL
        quality: Bitrate (192, 256, 320 kbps) - informational only, yt-dlp uses best available
        progress_callback: Called with progress percentage (0-100)
        cookies: Optional Netscape format cookies
    
    Returns:
        Path to downloaded file
    
    Raises:
        Exception: If download fails
    """
    downloads_dir = os.path.join(os.path.dirname(__file__), "downloads")
    os.makedirs(downloads_dir, exist_ok=True)
    
    output_template = os.path.join(downloads_dir, "audio_%(id)s.%(ext)s")
    
    # Build command - download best audio without conversion
    # Uses bestaudio format which is fastest (no transcoding)
    command = [
        "yt-dlp",
        "-f", "bestaudio",  # Best audio in native format (fastest)
        "--no-part",
        "--force-overwrites",  # Overwrite if exists
        "--no-warnings",
        "--js-runtimes", "node",  # YouTube extraction requires JS runtime
        "--remote-components", "ejs:github",  # Enable challenge solver for YouTube
    ]
    
    # Setup cookies file if provided
    cookies_file = None
    try:
        if cookies and cookies.strip():
            # Validate cookies format (basic check)
            if len(cookies) > 100000:
                raise ValueError("Cookies too large")
            
            fd, cookies_file = tempfile.mkstemp(suffix=".txt", prefix="cookies_")
            with os.fdopen(fd, 'w') as f:
                f.write(cookies)
            command.extend(["--cookies", cookies_file])
        else:
            # Use default cookies if available
            default_cookies = os.path.join(os.path.dirname(__file__), "cookies.txt")
            if os.path.exists(default_cookies):
                command.extend(["--cookies", default_cookies])
    except Exception as e:
        # Cleanup temp file on validation error
        if cookies_file and os.path.exists(cookies_file):
            try:
                os.remove(cookies_file)
            except:
                pass
        raise ValueError(f"Invalid cookies: {e}")
    
    command.extend([url, "-o", output_template])
    
    process = None
    output_file = None
    try:
        # Start process with stderr separate to capture progress
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Read stderr for progress updates in real-time
        for line in iter(process.stderr.readline, ''):
            if not line:
                break
            
            # Extract progress percentage from download lines
            match = re.search(r'(\d+\.\d)%', line)
            if match:
                try:
                    progress_pct = float(match.group(1))
                    progress_callback(progress_pct)
                except (ValueError, Exception):
                    pass
        
        # Wait for process to complete
        process.wait()
        
        # Find the downloaded file - any audio format
        # yt-dlp bestaudio typically outputs m4a or webm
        audio_files = (
            glob.glob(os.path.join(downloads_dir, "audio_*.m4a")) +
            glob.glob(os.path.join(downloads_dir, "audio_*.webm")) +
            glob.glob(os.path.join(downloads_dir, "audio_*.opus")) +
            glob.glob(os.path.join(downloads_dir, "audio_*.mp3"))
        )
        
        if audio_files:
            # Sort by modification time, get the most recent
            output_file = max(audio_files, key=lambda x: os.path.getmtime(x))
            return output_file
        
        # If process failed, report error
        if process.returncode != 0:
            raise Exception(f"yt-dlp failed with code {process.returncode}")
        
        raise Exception("No audio file generated")
    
    except Exception as e:
        # Cleanup process if still running
        if process and process.poll() is None:
            try:
                process.kill()
                process.wait(timeout=5)
            except:
                pass
        raise
    
    finally:
        # ALWAYS cleanup temp cookies file
        if cookies_file and os.path.exists(cookies_file):
            try:
                os.remove(cookies_file)
            except Exception as cleanup_error:
                # Log but don't fail on cleanup error
                print(f"Warning: Failed to cleanup cookies file: {cleanup_error}")
