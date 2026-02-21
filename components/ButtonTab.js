import React, { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function ButtonTab() {
  const [count, setCount] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Button Tab</Text>
      <Text style={styles.count}>Pressed {count} times</Text>
      <View style={styles.buttonWrap}>
        <Button title="Press me" onPress={() => setCount(c => c + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  count: { fontSize: 18, marginBottom: 12 },
  buttonWrap: { width: '60%' }
});
