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
    
    # Base commands
    command = [
        "yt-dlp",
        "--no-part",
        "--force-overwrites",
        "--no-warnings",
        "--no-cache-dir",
        "--no-check-certificate",
        "--verbose",  # Added to see exact cookie loading in Render logs
    ]

    # Platform-specific optimization
    if "youtube.com" in url or "youtu.be" in url:
        # YouTube datacenter fix: Force 'web' client (standard browser).
        # Mobile clients (ios, android, android_vr) are blocked on datacenter IPs.
        # Use flexible format selection with multiple fallbacks.
        command.extend([
            "-f", "bv*+ba/bv*+ba*/b/best",
            "-S", f"ext:mp4:m4a,{sort_spec}",
            "--merge-output-format", "mp4",
            "--extractor-args", "youtube:player-client=web",
        ])
    elif "twitter.com" in url or "x.com" in url:
        # Twitter specific
        command.extend([
            "-f", "best",
            "--referer", "https://twitter.com/",
        ])
    else:
        # Default for Insta, TikTok, etc.
        command.extend([
            "-f", "best",
        ])
    
    # Setup cookies file if provided
    cookies_file = None
    try:
        # Check for cookies passed from frontend
        if cookies and cookies.strip():
            fd, cookies_file = tempfile.mkstemp(suffix=".txt", prefix="cookies_")
            with os.fdopen(fd, 'w') as f:
                f.write(cookies)
            command.extend(["--cookies", cookies_file])
        else:
            # Check for local cookies.txt in the backend folder
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            default_cookies = os.path.join(backend_dir, "cookies.txt")
            if os.path.exists(default_cookies):
                # Using print temporarily for easy Render log visibility
                print(f"LOG: Loading default cookies from {default_cookies} ({os.path.getsize(default_cookies)} bytes)")
                command.extend(["--cookies", default_cookies])
            else:
                print(f"LOG: No cookies file found at {default_cookies}")
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
    stderr_content = []
    try:
        # Start process with stderr separate to capture progress and errors
        process = subprocess.Popen(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        assert process.stderr is not None  # guaranteed by stderr=PIPE
        
        # Read stderr for progress updates in real-time
        for line in iter(process.stderr.readline, ''):
            if not line:
                break
            
            stderr_content.append(line)
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
        
        # If process failed, report detailed error
        if process.returncode != 0:
            error_details = "".join(stderr_content[-10:]) # last 10 lines
            raise Exception(f"yt-dlp failed (code {process.returncode}): {error_details}")
        
        # Find the downloaded file
        video_files = glob.glob(os.path.join(downloads_dir, "video_*.mp4"))
        if video_files:
            output_file = max(video_files, key=lambda x: os.path.getmtime(x))
            return output_file
        
        raise Exception("No video file generated - check if the link is correct or platform is supported")
    
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
