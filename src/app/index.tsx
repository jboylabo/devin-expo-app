import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EarthWebGL } from '@/components/earth-webgl';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={styles.title}>
            WebGL Earth
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            OpenGL ES で描画された地球がゆっくり自転します
          </ThemedText>
        </View>

        <View style={styles.earthFrame}>
          <EarthWebGL style={styles.earth} />
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
          {Platform.OS === 'ios' ? 'Expo GLView / iOS' : 'Expo GLView'}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  earthFrame: {
    width: '100%',
    maxWidth: 440,
    aspectRatio: 1,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#020817',
    borderCurve: 'continuous',
    boxShadow: '0 0 42px rgba(55, 135, 255, 0.34)',
  },
  earth: {
    flex: 1,
  },
  caption: {
    textAlign: 'center',
  },
});
