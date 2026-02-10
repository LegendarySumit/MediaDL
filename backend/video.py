import subprocess
import re
import os
import tempfile
import signal
import glob
from typing import Optional, Callable


def download_video_with_progress(
    url: str,
    quality: str,
    progress_callback: Callable[[float], None],
    cookies: Optional[str] = None
) -> str:
    """
    Download video with specified quality (144, 360, 720, 1080)
    
    Args:
        url: Video URL
        quality: One of "144", "360", "720", "1080"
        progress_callback: Called with progress percentage (0-100)
        cookies: Optional Netscape format cookies
    
    Returns:
        Path to downloaded file
    
    Raises:
        Exception: If download fails
    """
    downloads_dir = os.path.join(os.path.dirname(__file__), "downloads")
    os.makedirs(downloads_dir, exist_ok=True)
    
    output_template = os.path.join(downloads_dir, "video_%(id)s.%(ext)s")
    
    # Map quality to resolution-based sort spec for yt-dlp
    quality_map = {
        "144": "res:144",
        "360": "res:360", 
        "720": "res:720",
        "1080": "res:1080"
    }
    
    sort_spec = quality_map.get(quality, quality_map["720"])
    
    # Build command with proper format and quality selection
    # Combines video+audio with proper quality filtering
    command = [
        "yt-dlp",
        "-f", "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/(bv*+ba/b)",  # Video+audio or best
        "-S", sort_spec,  # Sort by resolution
        "--no-part",  # Don't create .part files
        "--force-overwrites",  # Overwrite if exists
        "--no-warnings",  # Suppress warnings
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
        
        # Find the downloaded file - check what was actually created
        video_files = glob.glob(os.path.join(downloads_dir, "video_*.mp4"))
        if video_files:
            # Sort by modification time, get the most recent
            output_file = max(video_files, key=lambda x: os.path.getmtime(x))
            return output_file
        
        # If process failed, report error
        if process.returncode != 0:
            raise Exception(f"yt-dlp failed with code {process.returncode}")
        
        raise Exception("No video file generated")
    
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
