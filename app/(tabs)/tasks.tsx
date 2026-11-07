import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { DEFAULT_ROUTINE_BLOCKS } from '../../src/constants/routine';
import { CATEGORY_COLORS } from '../../src/constants/categories';

export default function TasksScreen() {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Daily Routine</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Default template blocks (editable in Step 7)
        </Text>
      </View>

      {DEFAULT_ROUTINE_BLOCKS.map((block) => {
        const catColor = CATEGORY_COLORS[block.category] || CATEGORY_COLORS.Other;
        return (
          <View
            key={block.blockId}
            style={[
              styles.blockCard,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: themeColors.primary }]}>{block.startTime}</Text>
              <View
                style={[
                  styles.categoryPill,
                  { backgroundColor: catColor.bg, borderColor: catColor.border },
                ]}
              >
                <Text style={[styles.categoryText, { color: catColor.text }]}>{block.category}</Text>
              </View>
            </View>
            <Text style={[styles.blockTitle, { color: themeColors.text }]}>{block.title}</Text>
            <Text style={[styles.blockMeta, { color: themeColors.textMuted }]}>
              {block.durationMin} minutes {block.isFixed ? '• 🔒 Fixed Commitment' : ''}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  blockCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  blockMeta: {
    fontSize: 13,
  },
});
