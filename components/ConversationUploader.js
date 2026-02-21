import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function ConversationUploader() {
  const [picked, setPicked] = useState(null);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Conversation Uploader</Text>
      <Text style={styles.text}>{picked ? `Selected: ${picked}` : 'No file selected (placeholder)'}</Text>
      <View style={styles.buttonWrap}>
        <Button title="Pick a conversation (placeholder)" onPress={() => setPicked('conversation.txt')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  text: { fontSize: 16, marginBottom: 12 },
  buttonWrap: { width: '80%' }
});
