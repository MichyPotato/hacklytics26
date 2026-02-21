#!/usr/bin/env python3
"""
Instagram Login Script using instagrapi
"""
import sys
import json
from instagrapi import Client
import traceback

def instagram_login(username, password):
    try:
        # Create client
        cl = Client()
        
        # Login
        cl.login(username, password)
        
        # Get user info
        user = cl.account_info()
        
        # Return success with user info and session
        result = {
            'success': True,
            'session_id': cl.client_id,  # Using client_id as session identifier
            'user_id': user.pk,
            'username': user.username,
            'full_name': user.full_name
        }
        
        print(json.dumps(result))
        return 0
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }), file=sys.stderr)
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': 'Missing username or password'
        }), file=sys.stderr)
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    sys.exit(instagram_login(username, password))
