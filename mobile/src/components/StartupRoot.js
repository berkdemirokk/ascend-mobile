import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

// This boundary deliberately depends only on React and React Native. Loading
// App inside its child render puts application-module evaluation under the
// boundary, including native SDK imports that can throw before App mounts.
export function RuntimeApp() {
  const App = require('../../App').default;
  return <App />;
}

const COPY = {
  title: 'Ascend',
  message: 'Ascend could not start. Please try again. / Ascend başlatılamadı. Lütfen yeniden deneyin.',
  restart: 'If this keeps happening, close Ascend and open it again. / Sorun sürerse Ascend uygulamasını tamamen kapatıp yeniden açın.',
  incident: 'Reference: ASC-BOOT-01',
  retry: 'Try again / Yeniden dene',
};

export default class StartupRoot extends React.Component {
  state = { error: null, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Native device logs remain available even when application analytics cannot load.
    console.error('[startup] Application failed before ready', error, info?.componentStack);
  }

  retry = () => {
    this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }));
  };

  render() {
    if (!this.state.error) return <RuntimeApp key={this.state.attempt} />;
    return (
      <View style={styles.container}>
        <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
        <Text style={styles.message} accessibilityRole="alert">{COPY.message}</Text>
        <Text style={styles.detail}>{COPY.restart}</Text>
        <Text style={styles.detail}>{COPY.incident}</Text>
        <Button title={COPY.retry} onPress={this.retry} color="#DC2626" />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#F9F9F9', padding: 32 },
  title: { fontSize: 28, fontWeight: '700', color: '#171717', marginBottom: 16 },
  message: { fontSize: 17, color: '#171717', marginBottom: 16 },
  detail: { fontSize: 13, color: '#525252', marginBottom: 24 },
});
