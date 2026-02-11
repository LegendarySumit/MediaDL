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
    base_command = [
        "yt-dlp",
        "--no-part",
        "--force-overwrites",
        "--no-warnings",
        "--no-cache-dir",
        "--no-check-certificate",
        "--verbose",  # Added to see exact cookie loading in Render logs
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]

    # PO Token handling (Critical for bot detection bypass)
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

        # Strategy 1: Web Safari (Bypasses GVS PO Token via HLS/m3u8 - Best current work-around)
        strategies.append({
            "name": "YouTube Web Safari",
            "args": [
                "-f", "best[protocol^=m3u8]/best", # Prefer M3U8 for Safari
                "--extractor-args", "youtube:player-client=web_safari",
            ]
        })

        # Strategy 2: TV Client (No PO Token required per docs, robust)
        strategies.append({
            "name": "YouTube TV Client",
            "args": [
                "-f", "best/bestvideo+bestaudio", # More flexible format selection
                "--extractor-args", "youtube:player-client=tv",
            ]
        })

        # Strategy 3: Android Client (Common mobile API)
        strategies.append({
            "name": "YouTube Android Client",
            "args": [
                "-f", "best",
                "--extractor-args", "youtube:player-client=android",
            ]
        })
        
        # Strategy 4: Web Client (Standard, with PO Token if available)
        web_extractor_args = get_extractor_args("web")
        strategies.append({
            "name": "YouTube Web Client",
            "args": [
                "-f", "bv*+ba/bv*+ba*/b/best",
                "-S", f"ext:mp4:m4a,{sort_spec}",
                "--merge-output-format", "mp4",
            ] + (["--extractor-args", ";".join(web_extractor_args)] if web_extractor_args else [])
        })

        # Strategy 5: iOS Client (Backup)
        strategies.append({
            "name": "YouTube iOS Client",
            "args": [
                "-f", "best",
                "--extractor-args", "youtube:player-client=ios",
            ]
        })
        
        # Strategy 6: No Client (Let yt-dlp decide default)
        strategies.append({
            "name": "YouTube Default",
            "args": ["-f", "best"]
        })

    elif "twitter.com" in url or "x.com" in url:
        # Twitter specific
        strategies.append({
            "name": "Twitter",
            "args": [
                "-f", "best",
                "--referer", "https://twitter.com/",
            ]
        })
    else:
        # Default for Insta, TikTok, etc.
        strategies.append({
            "name": "Generic",
            "args": ["-f", "best"]
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
                # Using print temporarily for easy Render log visibility
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

    try:
        for strategy in strategies:
            print(f"LOG: Attempting download with strategy: {strategy['name']}", flush=True)
            command = base_command + strategy["args"] + cookies_args + [url, "-o", output_template]
            
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
                    # Filter files modified very recently? 
                    # Actually glob captures all. We want the one related to this ID preferably, 
                    # but output_template has %(id)s.
                    # We should search for the specific file if possible, but ID is dynamic.
                    # Fallback to most recent is okay if concurrency is low, 
                    # but might be risky.
                    # Since we use video_%(id)s.%(ext)s, we don't know the exact filename 
                    # because ID might change (e.g. playlist index).
                    # But assuming single video.
                    output_file = max(video_files, key=lambda x: os.path.getmtime(x))
                    return output_file
                
                raise Exception("No video file generated - check if the link is correct or platform is supported")

            except Exception as e:
                last_error = e
                # Cleanup process if still running
                if process and process.poll() is None:
                    try:
                        process.kill()
                        process.wait(timeout=5)
                    except:
                        pass
                print(f"LOG: Strategy {strategy['name']} failed: {str(e)[:200]}...", flush=True)
                continue
        
        # If loop finishes without return, raise last error
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
