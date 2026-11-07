import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TopicTask } from '../types/topicTask';
import { useAppTheme } from '../stores/themeStore';
import { Colors } from '../constants/colors';

interface TaskItemProps {
  task: TopicTask;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}

const PRIORITY_BADGES: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: '#EF4444' },
  medium: { label: 'Med', color: '#F59E0B' },
  low: { label: 'Low', color: '#6B7280' },
};

export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];
  const priorityInfo = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
          opacity: task.isCompleted ? 0.7 : 1,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        style={[
          styles.checkbox,
          {
            borderColor: task.isCompleted ? themeColors.primary : themeColors.border,
            backgroundColor: task.isCompleted ? themeColors.primary : 'transparent',
          },
        ]}
      >
        {task.isCompleted && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.8} onPress={onEdit} style={styles.content}>
        <Text
          style={[
            styles.title,
            {
              color: task.isCompleted ? themeColors.textMuted : themeColors.text,
              textDecorationLine: task.isCompleted ? 'line-through' : 'none',
            },
          ]}
        >
          {task.title}
        </Text>

        <View style={styles.metaRow}>
          <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.color + '22' }]}>
            <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
              {priorityInfo.label}
            </Text>
          </View>
          {task.dueDate && (
            <Text style={[styles.dueDateText, { color: themeColors.textSecondary }]}>
              Due: {task.dueDate}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
        <Text style={[styles.deleteText, { color: themeColors.textMuted }]}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dueDateText: {
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 6,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

