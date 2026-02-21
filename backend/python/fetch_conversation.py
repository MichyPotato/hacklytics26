#!/usr/bin/env python3
"""
Fetch Instagram Conversation Script
"""
import sys
import json
from instagrapi import Client
import traceback

def fetch_conversation(username, conversation_with, password):
    try:
        # Create client
        cl = Client()
        
        # Login
        cl.login(username, password)
        
        # Get user ID of conversation partner
        user = cl.user_info_by_username(conversation_with)
        user_id = user.pk
        
        # Get messages with this user
        messages = cl.direct_messages(user_id)
        
        # Format messages
        formatted_messages = []
        if messages:
            for msg in messages:
                formatted_msg = {
                    'id': msg.id if hasattr(msg, 'id') else '',
                    'from_user': msg.user.username if hasattr(msg, 'user') and hasattr(msg.user, 'username') else username,
                    'to_user': conversation_with,
                    'text': msg.text if hasattr(msg, 'text') else '',
                    'type': msg.type if hasattr(msg, 'type') else 'text',
                    'timestamp': msg.created_at.isoformat() if hasattr(msg, 'created_at') else '',
                    'liked': msg.has_liked if hasattr(msg, 'has_liked') else False
                }
                formatted_messages.append(formatted_msg)
        
        print(json.dumps(formatted_messages))
        return 0
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }), file=sys.stderr)
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print(json.dumps({
            'success': False,
            'error': 'Missing required arguments'
        }), file=sys.stderr)
        sys.exit(1)
    
    username = sys.argv[1]
    conversation_with = sys.argv[2]
    password = sys.argv[3]  # In production, use session instead
    
    sys.exit(fetch_conversation(username, conversation_with, password))
