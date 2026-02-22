#!/usr/bin/env python3
"""
Instagram Login Script using instagrapi
Extracted from extract_messages.ipynb
"""
import sys
import json
import os
import time
from instagrapi import Client
import traceback

def instagram_login(username=None, password=None, config_path=None, proxy=None, use_session_file=True):
    """
    Login to Instagram using instagrapi with proper CSRF token handling.
    
    Args:
        username: Instagram username (optional, can be loaded from config)
        password: Instagram password (optional, can be loaded from config)
        config_path: Path to config.json file (default: ../data/config.json)
        proxy: Proxy URL to use (e.g., 'http://proxy:8080')
        use_session_file: Whether to save/load session to avoid repeated logins
    
    Returns:
        tuple: (success: bool, data: dict)
    """
    try:
        # Load credentials from config if not provided
        if username is None or password is None:
            if config_path is None:
                config_path = os.path.join(os.path.dirname(__file__), "../data/config.json")
            
            if os.path.exists(config_path):
                with open(config_path, "r") as f:
                    config = json.load(f)
                    ig_config = config.get('instagram', {})
                    username = username or ig_config.get('username')
                    password = password or ig_config.get('password')
                    proxy = proxy or ig_config.get('proxy')
        
        if not username or not password:
            raise ValueError("Username and password are required")
        
        # Try to load existing session file first
        session_file = os.path.join(os.path.dirname(__file__), f".session_{username}")
        if use_session_file and os.path.exists(session_file):
            try:
                cl = Client(proxy=proxy) if proxy else Client()
                cl.load_settings(session_file)
                # Test if session is valid
                user = cl.account_info()
                result = {
                    'success': True,
                    'user_id': user.pk,
                    'username': user.username,
                    'full_name': user.full_name,
                    'client': cl,
                    'from_cache': True
                }
                return True, result
            except Exception as e:
                # Session expired, continue with fresh login
                pass
        
        # Create fresh client with proper settings
        cl = Client(proxy=proxy) if proxy else Client()
        
        # Set User-Agent to mimic real browser
        cl.set_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )
        
        # Important: Initialize session with a GET request to fetch CSRF token
        try:
            cl.get_settings()
        except Exception:
            # Ignore errors from initial GET, we just need to establish session
            pass
        
        # Add delay to avoid triggering rate limits
        time.sleep(1)
        
        # Now attempt login
        cl.login(username, password)
        
        # Save session for next time
        if use_session_file:
            try:
                cl.dump_settings(session_file)
            except Exception:
                pass  # Session save is optional
        
        # Get user info
        user = cl.account_info()
        
        # Return success with user info
        result = {
            'success': True,
            'user_id': user.pk,
            'username': user.username,
            'full_name': user.full_name,
            'client': cl,
            'from_cache': False
        }
        return True, result
        
    except Exception as e:
        return False, {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback.format_exc()
        }

if __name__ == '__main__':
    username = None
    password = None
    proxy = None
    
    # Get credentials from command line args if provided
    # Format: instagram_login.py [username] [password] [proxy_url]
    if len(sys.argv) >= 2:
        username = sys.argv[1]
    if len(sys.argv) >= 3:
        password = sys.argv[2]
    if len(sys.argv) >= 4:
        proxy = sys.argv[3]
    
    success, result = instagram_login(username, password, proxy=proxy)
    
    if success:
        # Remove client object before JSON serialization
        result.pop('client', None)
        print(json.dumps(result))
        sys.exit(0)
    else:
        print(json.dumps(result), file=sys.stderr)
        sys.exit(1)
