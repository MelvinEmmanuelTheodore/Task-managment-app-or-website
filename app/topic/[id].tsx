import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { TaskItem } from '../../src/components/TaskItem';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Priority } from '../../src/types/category';

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  const {
    topics,
    categories,
    getTasksByTopic,
    getTopicProgress,
    addTask,
    toggleTaskComplete,
    deleteTask,
    updateTopic,
    deleteTopic,
  } = useCategoryTopicStore();

  const topic = topics.find((t) => t.id === id);
  const category = categories.find((c) => c.id === topic?.categoryId);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  if (!topic) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.errorText, { color: themeColors.text }]}>Topic not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={{ color: themeColors.primary }}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tasks = getTasksByTopic(topic.id);
  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const progress = getTopicProgress(topic.id);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    await addTask(topic.id, newTitle.trim(), newPriority);
    setNewTitle('');
  };

  const handleDeleteConfirmedTopic = async () => {
    await deleteTopic(topic.id);
    setShowDeleteModal(false);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: topic.name,
          headerBackTitle: 'Dashboard',
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Category Header Card */}
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={styles.badgeRow}>
            {category && (
              <View style={[styles.catBadge, { backgroundColor: category.color + '22', borderColor: category.color }]}>
                <Text style={[styles.catBadgeText, { color: category.color }]}>{category.name}</Text>
              </View>
            )}
            <View style={[styles.statusBadge, { backgroundColor: topic.isActive ? '#05966922' : '#6B728022' }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: topic.isActive ? '#10B981' : '#9CA3AF' }}>
                {topic.isActive ? 'ACTIVE' : 'DEACTIVATED'}
              </Text>
            </View>
          </View>

          <Text style={[styles.topicTitle, { color: themeColors.text }]}>{topic.name}</Text>

          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <Text style={[styles.progressLabel, { color: themeColors.textSecondary }]}>
                Completion Progress: {progress.completed} of {progress.total} done
              </Text>
              <Text style={[styles.progressPercentage, { color: themeColors.text }]}>
                {progress.percentage}%
              </Text>
            </View>
            <ProgressBar percentage={progress.percentage} color={category?.color || '#3B82F6'} height={8} />
          </View>
        </View>

        {/* Task Creation Input */}
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Add New Task</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border },
              ]}
              placeholder="What needs to be done?"
              placeholderTextColor={themeColors.textMuted}
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={handleCreateTask}
            />
          </View>

          <View style={styles.prioritySelectorRow}>
            <Text style={[styles.priorityLabel, { color: themeColors.textSecondary }]}>Priority:</Text>
            {(['high', 'medium', 'low'] as Priority[]).map((p) => {
              const selected = newPriority === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setNewPriority(p)}
                  style={[
                    styles.priorityPill,
                    {
                      backgroundColor: selected ? themeColors.primary : themeColors.surfaceSecondary,
                      borderColor: selected ? themeColors.primary : themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.priorityPillText, { color: selected ? '#FFF' : themeColors.text }]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={handleCreateTask} style={[styles.addButton, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending Tasks */}
        <View style={styles.taskSection}>
          <Text style={[styles.sectionHeading, { color: themeColors.text }]}>
            Pending Tasks ({pendingTasks.length})
          </Text>
          {pendingTasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              onToggle={() => toggleTaskComplete(t.id)}
              onDelete={() => setTaskToDelete(t.id)}
            />
          ))}
          {pendingTasks.length === 0 && (
            <Text style={[styles.emptySectionText, { color: themeColors.textMuted }]}>
              No pending tasks. Add one above!
            </Text>
          )}
        </View>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && (
          <View style={styles.taskSection}>
            <Text style={[styles.sectionHeading, { color: themeColors.textMuted }]}>
              Completed Tasks ({completedTasks.length})
            </Text>
            {completedTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => toggleTaskComplete(t.id)}
                onDelete={() => setTaskToDelete(t.id)}
              />
            ))}
          </View>
        )}

        {/* Delete Topic Button */}
        <TouchableOpacity
          onPress={() => setShowDeleteModal(true)}
          style={[styles.deleteTopicButton, { borderColor: themeColors.danger }]}
        >
          <Text style={[styles.deleteTopicText, { color: themeColors.danger }]}>Delete This Topic</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Confirmation Modals */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Delete Topic"
        message={`Are you sure you want to delete "${topic.name}" and all ${tasks.length} tasks under it?`}
        confirmText="Delete Topic"
        isDestructive
        onConfirm={handleDeleteConfirmedTopic}
        onCancel={() => setShowDeleteModal(false)}
      />

      <ConfirmModal
        visible={taskToDelete !== null}
        title="Delete Task"
        message="Are you sure you want to remove this task?"
        confirmText="Delete"
        isDestructive
        onConfirm={async () => {
          if (taskToDelete) {
            await deleteTask(taskToDelete);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  card: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  topicTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
  },
  progressSection: {
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputRow: {
    marginBottom: 10,
  },
  textInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addButton: {
    marginLeft: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  taskSection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySectionText: {
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  deleteTopicButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  deleteTopicText: {
    fontSize: 14,
    fontWeight: '700',
  },
});

