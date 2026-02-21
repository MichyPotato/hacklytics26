#!/usr/bin/env python3
"""
Get Instagram Conversations Script
"""
import sys
import json
from instagrapi import Client
import traceback

def get_conversations(username, password):
    try:
        # Create client
        cl = Client()
        
        # Login
        cl.login(username, password)
        
        # Get inbox threads (conversations)
        threads = cl.direct_threads()
        
        conversations = []
        for thread in threads:
            # Get participants (conversation partners)
            participants = []
            if hasattr(thread, 'users') and thread.users:
                for user in thread.users:
                    if user.username != username:  # Don't include the logged-in user
                        participants.append({
                            'id': user.pk,
                            'username': user.username,
                            'full_name': user.full_name if hasattr(user, 'full_name') else ''
                        })
            
            conversation = {
                'thread_id': thread.pk,
                'title': thread.thread_title if hasattr(thread, 'thread_title') else '',
                'participants': participants,
                'last_activity': thread.updated_on.isoformat() if hasattr(thread, 'updated_on') else '',
                'messages_count': thread.messages_count if hasattr(thread, 'messages_count') else 0
            }
            conversations.append(conversation)
        
        print(json.dumps(conversations))
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
            'error': 'Missing username or session ID'
        }), file=sys.stderr)
        sys.exit(1)
    
    username = sys.argv[1]
    session_id = sys.argv[2]
    
    # Note: In a production app, you would use the session_id to restore a session
    # instead of re-authenticating. For now, we need the password.
    # A better approach would be to store the session and pass that instead.
    
    sys.exit(get_conversations(username, session_id))
