import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { ConfirmModal } from '../../src/components/ConfirmModal';
import { Priority, Category } from '../../src/types/category';
import { Topic } from '../../src/types/topic';

const PALETTE = ['#2563EB', '#7C3AED', '#059669', '#DB2777', '#D97706', '#4B5563', '#DC2626', '#0891B2'];

export default function CategoriesScreen() {
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];

  const {
    categories,
    topics,
    topicTasks,
    addCategory,
    updateCategory,
    deleteCategoryCascade,
    moveCategoryContentsAndDelete,
    addTopic,
    updateTopic,
    toggleTopicActive,
    deleteTopic,
  } = useCategoryTopicStore();

  const { blocks: timetableBlocks } = useTimetableStore();

  // Create Category Modal / Form State
  const [showAddCat, setShowAddCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catPriority, setCatPriority] = useState<Priority>('medium');
  const [catColor, setCatColor] = useState(PALETTE[0]);

  // Create Topic Form State
  const [activeCatForNewTopic, setActiveCatForNewTopic] = useState<string | null>(null);
  const [topicName, setTopicName] = useState('');
  const [topicPriority, setTopicPriority] = useState<Priority>('medium');

  // Cascade Deletion State
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [targetMoveCatId, setTargetMoveCatId] = useState<string>('');
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);

  const handleCreateCategory = async () => {
    if (!catName.trim()) return;
    await addCategory(catName.trim(), catPriority, catColor);
    setCatName('');
    setShowAddCat(false);
  };

  const handleCreateTopic = async (categoryId: string) => {
    if (!topicName.trim()) return;
    await addTopic(categoryId, topicName.trim(), topicPriority);
    setTopicName('');
    setActiveCatForNewTopic(null);
  };

  // Inspect dependent counts for category deletion
  const getCategoryDependencies = (categoryId: string) => {
    const dependentTopics = topics.filter((t) => t.categoryId === categoryId);
    const topicIds = new Set(dependentTopics.map((t) => t.id));
    const dependentTasks = topicTasks.filter((task) => topicIds.has(task.topicId));
    const dependentBlocks = timetableBlocks.filter((b) => b.categoryId === categoryId);

    return {
      topicsCount: dependentTopics.length,
      tasksCount: dependentTasks.length,
      blocksCount: dependentBlocks.length,
      hasDependencies: dependentTopics.length > 0 || dependentBlocks.length > 0,
    };
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Category & Topic Manager</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Manage hierarchy, priorities, and topic states
        </Text>
      </View>

      {/* Add Category Section */}
      {!showAddCat ? (
        <TouchableOpacity
          onPress={() => setShowAddCat(true)}
          style={[styles.newCatButton, { backgroundColor: themeColors.primary }]}
        >
          <Text style={styles.newCatButtonText}>+ Add New Category</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.cardHeading, { color: themeColors.text }]}>Create Category</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="Category Name (e.g. Mechanical Engineering)"
            placeholderTextColor={themeColors.textMuted}
            value={catName}
            onChangeText={setCatName}
          />

          <View style={styles.inlineRow}>
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>Priority:</Text>
            {(['high', 'medium', 'low'] as Priority[]).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setCatPriority(p)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: catPriority === p ? themeColors.primary : themeColors.surfaceSecondary,
                    borderColor: catPriority === p ? themeColors.primary : themeColors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: catPriority === p ? '#FFF' : themeColors.text }}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.colorPaletteRow}>
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCatColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c, borderWidth: catColor === c ? 3 : 0, borderColor: '#FFFFFF' },
                ]}
              />
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={() => setShowAddCat(false)} style={styles.cancelAction}>
              <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCreateCategory} style={[styles.saveAction, { backgroundColor: themeColors.primary }]}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category List */}
      {categories.map((cat) => {
        const catTopics = topics.filter((t) => t.categoryId === cat.id);
        const deps = getCategoryDependencies(cat.id);

        return (
          <View
            key={cat.id}
            style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
          >
            <View style={styles.catHeader}>
              <View style={styles.catTitleRow}>
                <View style={[styles.colorBlock, { backgroundColor: cat.color }]} />
                <Text style={[styles.catName, { color: themeColors.text }]}>{cat.name}</Text>
                <View style={[styles.priorityPill, { backgroundColor: cat.color + '22' }]}>
                  <Text style={{ color: cat.color, fontSize: 10, fontWeight: '800' }}>
                    {cat.priority.toUpperCase()}
                  </Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setCatToDelete(cat)} style={styles.deleteIconButton}>
                <Text style={{ color: themeColors.danger, fontSize: 13, fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>

            {/* Topics under category */}
            <View style={styles.topicList}>
              {catTopics.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.topicRow,
                    { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border },
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => toggleTopicActive(t.id)}
                    style={[
                      styles.activeToggle,
                      { backgroundColor: t.isActive ? '#059669' : '#6B7280' },
                    ]}
                  >
                    <Text style={styles.toggleText}>{t.isActive ? 'Active' : 'Off'}</Text>
                  </TouchableOpacity>

                  <Text
                    style={[
                      styles.topicRowText,
                      {
                        color: t.isActive ? themeColors.text : themeColors.textMuted,
                        textDecorationLine: t.isActive ? 'none' : 'line-through',
                      },
                    ]}
                  >
                    {t.name}
                  </Text>

                  <TouchableOpacity onPress={() => setTopicToDelete(t)} style={styles.topicDeleteButton}>
                    <Text style={{ color: themeColors.textMuted, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add Topic Under Category */}
              {activeCatForNewTopic === cat.id ? (
                <View style={styles.newTopicForm}>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border },
                    ]}
                    placeholder="New topic title..."
                    placeholderTextColor={themeColors.textMuted}
                    value={topicName}
                    onChangeText={setTopicName}
                  />
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setActiveCatForNewTopic(null)}>
                      <Text style={{ color: themeColors.textMuted, marginRight: 12 }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleCreateTopic(cat.id)}
                      style={[styles.smallAddButton, { backgroundColor: themeColors.primary }]}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 12 }}>Add Topic</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setActiveCatForNewTopic(cat.id);
                    setTopicName('');
                  }}
                  style={styles.addTopicLink}
                >
                  <Text style={{ color: themeColors.primary, fontSize: 13, fontWeight: '600' }}>
                    + Add Topic to {cat.name}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={{ height: 40 }} />

      {/* Delete Topic Confirmation */}
      <ConfirmModal
        visible={topicToDelete !== null}
        title="Delete Topic"
        message={`Delete "${topicToDelete?.name}" and all tasks under it?`}
        confirmText="Delete"
        isDestructive
        onConfirm={async () => {
          if (topicToDelete) {
            await deleteTopic(topicToDelete.id);
            setTopicToDelete(null);
          }
        }}
        onCancel={() => setTopicToDelete(null)}
      />

      {/* Category Cascade Deletion Modal */}
      {catToDelete && (
        <ConfirmModal
          visible={catToDelete !== null}
          title={`Delete Category "${catToDelete.name}"`}
          message={
            (() => {
              const deps = getCategoryDependencies(catToDelete.id);
              if (deps.hasDependencies) {
                return `WARNING: This category contains ${deps.topicsCount} topics, ${deps.tasksCount} topic tasks, and ${deps.blocksCount} timetable blocks.\n\nDeleting will permanently remove all associated topics and tasks!`;
              }
              return 'Are you sure you want to delete this category?';
            })()
          }
          confirmText="Delete Category & Contents"
          isDestructive
          onConfirm={async () => {
            await deleteCategoryCascade(catToDelete.id);
            setCatToDelete(null);
          }}
          onCancel={() => setCatToDelete(null)}
        />
      )}
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
  newCatButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  newCatButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelAction: {
    padding: 8,
  },
  saveAction: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorBlock: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  catName: {
    fontSize: 16,
    fontWeight: '700',
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deleteIconButton: {
    padding: 6,
  },
  topicList: {
    gap: 8,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeToggle: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 8,
  },
  toggleText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  topicRowText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  topicDeleteButton: {
    padding: 4,
  },
  addTopicLink: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  newTopicForm: {
    marginTop: 6,
  },
  smallAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});

