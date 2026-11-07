import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Topic } from '../types/topic';
import { ProgressBar } from './ProgressBar';
import { useAppTheme } from '../stores/themeStore';
import { Colors } from '../constants/colors';

interface TopicCardProps {
  topic: Topic;
  categoryColor: string;
  total?: number;
  completed?: number;
  percentage?: number;
  onPress: () => void;
}

export function TopicCard({
  topic,
  categoryColor,
  total = 0,
  completed = 0,
  percentage = 0,
  onPress,
}: TopicCardProps) {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <View style={[styles.priorityDot, { backgroundColor: categoryColor }]} />
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
            {topic.name}
          </Text>
        </View>
        <Text style={[styles.progressText, { color: themeColors.textMuted }]}>
          {completed}/{total}
        </Text>
      </View>

      <View style={styles.progressContainer}>
        <ProgressBar percentage={percentage} color={categoryColor} height={6} showLabel={false} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressContainer: {
    marginTop: 2,
  },
});

