import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { TaskItem } from '../../src/components/TaskItem';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Priority } from '../../src/types/category';
import { TopicTask } from '../../src/types/topicTask';

export default function TopicDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  const {
    topics,
    categories,
    topicTasks,
    addTask,
    updateTask,
    toggleTaskComplete,
    deleteTask,
    deleteTopic,
  } = useCategoryTopicStore();

  const topic = topics.find((t) => t.id === id);
  const category = categories.find((c) => c.id === topic?.categoryId);

  // Task Creation State
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showAdvancedCreate, setShowAdvancedCreate] = useState(false);

  // Task Editing State
  const [editingTask, setEditingTask] = useState<TopicTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Confirmation Modals
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

  // Derive topic tasks and progress from store state
  const tasks = topicTasks
    .filter((t) => t.topicId === topic.id)
    .sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return a.createdAt.seconds - b.createdAt.seconds;
    });

  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const total = tasks.length;
  const completed = completedTasks.length;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    await addTask(
      topic.id,
      newTitle.trim(),
      newPriority,
      newDueDate.trim() || null,
      newNotes.trim()
    );
    setNewTitle('');
    setNewDueDate('');
    setNewNotes('');
    setShowAdvancedCreate(false);
  };

  const handleOpenEditTask = (task: TopicTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate || '');
    setEditNotes(task.notes || '');
  };

  const handleSaveEditTask = async () => {
    if (!editingTask || !editTitle.trim()) return;
    await updateTask({
      ...editingTask,
      title: editTitle.trim(),
      priority: editPriority,
      dueDate: editDueDate.trim() || null,
      notes: editNotes.trim(),
    });
    setEditingTask(null);
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
                Completion Progress: {completed} of {total} done
              </Text>
              <Text style={[styles.progressPercentage, { color: themeColors.text }]}>
                {percentage}%
              </Text>
            </View>
            <ProgressBar percentage={percentage} color={category?.color || '#3B82F6'} height={8} />
          </View>
        </View>

        {/* Task Creation Card */}
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
            <TouchableOpacity
              onPress={() => setShowAdvancedCreate(!showAdvancedCreate)}
              style={styles.moreOptionsLink}
            >
              <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>
                {showAdvancedCreate ? '▲ Less' : '▼ Details'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Optional Details: Due Date & Notes */}
          {showAdvancedCreate && (
            <View style={styles.advancedFields}>
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Due Date (YYYY-MM-DD):</Text>
              <TextInput
                style={[
                  styles.smallInput,
                  { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border },
                ]}
                placeholder="e.g. 2026-11-20"
                placeholderTextColor={themeColors.textMuted}
                value={newDueDate}
                onChangeText={setNewDueDate}
              />
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Notes:</Text>
              <TextInput
                style={[
                  styles.multilineInput,
                  { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border },
                ]}
                placeholder="Optional notes or context..."
                placeholderTextColor={themeColors.textMuted}
                multiline
                numberOfLines={2}
                value={newNotes}
                onChangeText={setNewNotes}
              />
            </View>
          )}

          <TouchableOpacity onPress={handleCreateTask} style={[styles.addButton, { backgroundColor: themeColors.primary }]}>
            <Text style={styles.addButtonText}>Add Task</Text>
          </TouchableOpacity>
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
              onEdit={() => handleOpenEditTask(t)}
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
                onEdit={() => handleOpenEditTask(t)}
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

      {/* Edit Task Modal */}
      {editingTask && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingTask(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Task</Text>
              
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>Title:</Text>
              <TextInput
                style={[
                  styles.smallInput,
                  { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border },
                ]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Task title"
                placeholderTextColor={themeColors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>Priority:</Text>
              <View style={styles.prioritySelectorRow}>
                {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                  const selected = editPriority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setEditPriority(p)}
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
              </View>

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>
                Due Date (YYYY-MM-DD):
              </Text>
              <TextInput
                style={[
                  styles.smallInput,
                  { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border },
                ]}
                value={editDueDate}
                onChangeText={setEditDueDate}
                placeholder="e.g. 2026-11-20"
                placeholderTextColor={themeColors.textMuted}
              />

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary, marginTop: 8 }]}>Notes:</Text>
              <TextInput
                style={[
                  styles.multilineInput,
                  { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border },
                ]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Optional notes..."
                placeholderTextColor={themeColors.textMuted}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity onPress={() => setEditingTask(null)} style={styles.modalCancel}>
                  <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEditTask}
                  style={[styles.modalSave, { backgroundColor: themeColors.primary }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  backButton: {
    padding: 10,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  topicTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  progressSection: {
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputRow: {
    marginBottom: 10,
  },
  textInput: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  prioritySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  priorityLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  moreOptionsLink: {
    marginLeft: 'auto',
    padding: 4,
  },
  advancedFields: {
    marginTop: 4,
    marginBottom: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  smallInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 56,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  addButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptySectionText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  deleteTopicButton: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteTopicText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 14,
  },
  modalCancel: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalSave: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
});
