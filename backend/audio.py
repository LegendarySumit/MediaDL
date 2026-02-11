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
    
    # Base commands
    base_command = [
        "yt-dlp",
        "--no-part",
        "--force-overwrites",
        "--no-warnings",
        "--no-cache-dir",
        "--no-check-certificate",
        "--verbose",  # Added for debugging
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]

    # PO Token handling
    po_token = os.getenv("YOUTUBE_PO_TOKEN")
    visitor_data = os.getenv("YOUTUBE_VISITOR_DATA")

    # Define download strategies
    strategies = []
    
    # Platform-specific optimization
    if "youtube.com" in url or "youtu.be" in url:
        
        # Helper to construct extractor args
        def get_extractor_args(client="web"):
            args = []
            if client:
                args.append(f"youtube:player-client={client}")
            if po_token:
                args.append(f"youtube:po_token=web+{po_token}" if client == "web" else f"youtube:po_token={po_token}")
            if visitor_data:
                args.append(f"youtube:visitor_data={visitor_data}")
            return args

        # Strategy 1: Web Safari (Often bypasses GVS PO Token via HLS)
        strategies.append({
            "name": "YouTube Web Safari",
            "args": [
                "-f", "bestaudio/best",
                "--extractor-args", "youtube:player-client=web_safari",
            ]
        })

        # Strategy 2: Android Client (Common mobile API)
        strategies.append({
            "name": "YouTube Android Client",
            "args": [
                "-f", "bestaudio/best",
                "--extractor-args", "youtube:player-client=android",
            ]
        })
        
        # Strategy 3: Web Client (Standard, with PO Token if available)
        web_extractor_args = get_extractor_args("web")
        strategies.append({
            "name": "YouTube Web Client",
            "args": [
                "-f", "bestaudio/best",
            ] + (["--extractor-args", ";".join(web_extractor_args)] if web_extractor_args else [])
        })
        
        # Strategy 4: TV Client (Backup)
        strategies.append({
            "name": "YouTube TV Client",
            "args": [
                "-f", "bestaudio/best",
                "--extractor-args", "youtube:player-client=tv",
            ]
        })

    elif "twitter.com" in url or "x.com" in url:
        strategies.append({
            "name": "Twitter",
            "args": [
                "-f", "bestaudio/best",
                "--referer", "https://twitter.com/",
            ]
        })
    else:
        strategies.append({
            "name": "Generic",
            "args": [
                "-f", "bestaudio/best",
            ]
        })
    
    # Setup cookies file if provided
    cookies_args = []
    cookies_file = None
    try:
        # Check for cookies passed from frontend
        if cookies and cookies.strip():
            fd, cookies_file = tempfile.mkstemp(suffix=".txt", prefix="cookies_")
            with os.fdopen(fd, 'w') as f:
                f.write(cookies)
            cookies_args = ["--cookies", cookies_file]
        else:
            # Check for local cookies.txt in the backend folder
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            default_cookies = os.path.join(backend_dir, "cookies.txt")
            if os.path.exists(default_cookies):
                print(f"LOG: Loading default cookies from {default_cookies} ({os.path.getsize(default_cookies)} bytes)")
                cookies_args = ["--cookies", default_cookies]
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
    
    last_error = None
    process = None
    output_file = None
    
    try:
        for strategy in strategies:
            print(f"LOG: Attempting download with strategy: {strategy['name']}")
            command = base_command + strategy["args"] + cookies_args + [url, "-o", output_template]
            
            stderr_content = []
            try:
                # Start process with stderr separate to capture progress
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
                
                 # Find the downloaded file - any audio format
                # yt-dlp bestaudio typically outputs m4a or webm
                audio_files = (
                    glob.glob(os.path.join(downloads_dir, "audio_*.m4a")) +
                    glob.glob(os.path.join(downloads_dir, "audio_*.webm")) +
                    glob.glob(os.path.join(downloads_dir, "audio_*.opus")) +
                    glob.glob(os.path.join(downloads_dir, "audio_*.mp3")) +
                    glob.glob(os.path.join(downloads_dir, "audio_*.mp4"))
                )
                
                if audio_files:
                    # Sort by modification time, get the most recent
                    output_file = max(audio_files, key=lambda x: os.path.getmtime(x))
                    return output_file
                
                # If process failed, report error with details
                if process.returncode != 0:
                    # Collect any remaining stderr
                    error_details = "".join(stderr_content[-20:])
                    raise Exception(f"yt-dlp failed with code {process.returncode}: {error_details}")
                
                raise Exception("No audio file generated")

            except Exception as e:
                last_error = e
                # Cleanup process if still running
                if process and process.poll() is None:
                    try:
                        process.kill()
                        process.wait(timeout=5)
                    except:
                        pass
                print(f"LOG: Strategy {strategy['name']} failed: {str(e)[:200]}...")
                continue
        
        # If loop finishes with error
        if last_error:
            raise last_error
        else:
            raise Exception("Download failed with no specific error")

    finally:
        # ALWAYS cleanup temp cookies file
        if cookies_file and os.path.exists(cookies_file):
            try:
                os.remove(cookies_file)
            except Exception as cleanup_error:
                # Log but don't fail on cleanup error
                print(f"Warning: Failed to cleanup cookies file: {cleanup_error}")
