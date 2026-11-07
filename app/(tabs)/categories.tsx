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
    moveCategoryOrder,
    deleteCategoryCascade,
    moveCategoryContentsAndDelete,
    addTopic,
    updateTopic,
    moveTopicOrder,
    toggleTopicActive,
    deleteTopic,
  } = useCategoryTopicStore();

  const { blocks: timetableBlocks } = useTimetableStore();

  // Create Category Form State
  const [showAddCat, setShowAddCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catPriority, setCatPriority] = useState<Priority>('medium');
  const [catColor, setCatColor] = useState(PALETTE[0]);

  // Edit Category Modal State
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatPriority, setEditCatPriority] = useState<Priority>('medium');
  const [editCatColor, setEditCatColor] = useState(PALETTE[0]);

  // Create Topic Form State
  const [activeCatForNewTopic, setActiveCatForNewTopic] = useState<string | null>(null);
  const [topicName, setTopicName] = useState('');
  const [topicPriority, setTopicPriority] = useState<Priority>('medium');

  // Edit Topic Modal State
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [editTopicPriority, setEditTopicPriority] = useState<Priority>('medium');

  // Deletion & Move State
  const [catToDelete, setCatToDelete] = useState<Category | null>(null);
  const [targetMoveCatId, setTargetMoveCatId] = useState<string>('');
  const [topicToDelete, setTopicToDelete] = useState<Topic | null>(null);

  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCreateCategory = async () => {
    if (!catName.trim()) return;
    await addCategory(catName.trim(), catPriority, catColor);
    setCatName('');
    setShowAddCat(false);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCat(cat);
    setEditCatName(cat.name);
    setEditCatPriority(cat.priority);
    setEditCatColor(cat.color);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCat || !editCatName.trim()) return;
    await updateCategory({
      ...editingCat,
      name: editCatName.trim(),
      priority: editCatPriority,
      color: editCatColor,
    });
    setEditingCat(null);
  };

  const handleCreateTopic = async (categoryId: string) => {
    if (!topicName.trim()) return;
    await addTopic(categoryId, topicName.trim(), topicPriority);
    setTopicName('');
    setActiveCatForNewTopic(null);
  };

  const handleOpenEditTopic = (topic: Topic) => {
    setEditingTopic(topic);
    setEditTopicName(topic.name);
    setEditTopicPriority(topic.priority);
  };

  const handleSaveEditTopic = async () => {
    if (!editingTopic || !editTopicName.trim()) return;
    await updateTopic({
      ...editingTopic,
      name: editTopicName.trim(),
      priority: editTopicPriority,
    });
    setEditingTopic(null);
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

  const handleOpenDeleteCategory = (cat: Category) => {
    setCatToDelete(cat);
    const available = categories.filter((c) => c.id !== cat.id);
    setTargetMoveCatId(available[0]?.id || '');
  };

  const handleCascadeDeleteConfirmed = async () => {
    if (!catToDelete) return;
    await deleteCategoryCascade(catToDelete.id);
    setCatToDelete(null);
  };

  const handleMoveAndDeleteConfirmed = async () => {
    if (!catToDelete || !targetMoveCatId || catToDelete.id === targetMoveCatId) return;
    await moveCategoryContentsAndDelete(catToDelete.id, targetMoveCatId);
    setCatToDelete(null);
  };

  const otherCategories = catToDelete ? categories.filter((c) => c.id !== catToDelete.id) : [];
  const catToDeleteDeps = catToDelete ? getCategoryDependencies(catToDelete.id) : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Category & Topic Manager</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Manage hierarchy, priorities, reordering, and dependencies
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
      {sortedCategories.map((cat, catIdx) => {
        const catTopics = topics
          .filter((t) => t.categoryId === cat.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);

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

              {/* Category Controls: Reorder, Edit, Delete */}
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  disabled={catIdx === 0}
                  onPress={() => moveCategoryOrder(cat.id, 'up')}
                  style={[styles.iconButton, { opacity: catIdx === 0 ? 0.3 : 1 }]}
                >
                  <Text style={[styles.iconText, { color: themeColors.textSecondary }]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={catIdx === sortedCategories.length - 1}
                  onPress={() => moveCategoryOrder(cat.id, 'down')}
                  style={[styles.iconButton, { opacity: catIdx === sortedCategories.length - 1 ? 0.3 : 1 }]}
                >
                  <Text style={[styles.iconText, { color: themeColors.textSecondary }]}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenEditCategory(cat)} style={styles.editIconButton}>
                  <Text style={{ color: themeColors.primary, fontSize: 13, fontWeight: '700' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenDeleteCategory(cat)} style={styles.deleteIconButton}>
                  <Text style={{ color: themeColors.danger, fontSize: 13, fontWeight: '700' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Topics under category */}
            <View style={styles.topicList}>
              {catTopics.map((t, topicIdx) => (
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
                    numberOfLines={1}
                  >
                    {t.name}
                  </Text>

                  <View style={[styles.priorityPill, { backgroundColor: '#4B556333', marginRight: 6 }]}>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 9, fontWeight: '700' }}>
                      {t.priority.toUpperCase()}
                    </Text>
                  </View>

                  {/* Topic Controls: Reorder, Edit, Delete */}
                  <View style={styles.topicControlsRow}>
                    <TouchableOpacity
                      disabled={topicIdx === 0}
                      onPress={() => moveTopicOrder(t.id, 'up')}
                      style={[styles.smallIconBtn, { opacity: topicIdx === 0 ? 0.25 : 1 }]}
                    >
                      <Text style={[styles.smallIconText, { color: themeColors.textSecondary }]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={topicIdx === catTopics.length - 1}
                      onPress={() => moveTopicOrder(t.id, 'down')}
                      style={[styles.smallIconBtn, { opacity: topicIdx === catTopics.length - 1 ? 0.25 : 1 }]}
                    >
                      <Text style={[styles.smallIconText, { color: themeColors.textSecondary }]}>▼</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleOpenEditTopic(t)} style={styles.smallEditBtn}>
                      <Text style={{ color: themeColors.primary, fontSize: 11, fontWeight: '700' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTopicToDelete(t)} style={styles.topicDeleteButton}>
                      <Text style={{ color: themeColors.textMuted, fontSize: 13 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
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
                  <View style={styles.inlineRow}>
                    <Text style={[styles.label, { color: themeColors.textSecondary }]}>Priority:</Text>
                    {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setTopicPriority(p)}
                        style={[
                          styles.pill,
                          {
                            backgroundColor: topicPriority === p ? themeColors.primary : themeColors.surfaceSecondary,
                            borderColor: topicPriority === p ? themeColors.primary : themeColors.border,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: topicPriority === p ? '#FFF' : themeColors.text }}>
                          {p.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
                    setTopicPriority('medium');
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

      {/* Edit Category Modal */}
      {editingCat && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingCat(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Category</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                value={editCatName}
                onChangeText={setEditCatName}
                placeholder="Category Name"
                placeholderTextColor={themeColors.textMuted}
              />
              <View style={styles.inlineRow}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Priority:</Text>
                {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setEditCatPriority(p)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: editCatPriority === p ? themeColors.primary : themeColors.surfaceSecondary,
                        borderColor: editCatPriority === p ? themeColors.primary : themeColors.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: editCatPriority === p ? '#FFF' : themeColors.text }}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.colorPaletteRow}>
                {PALETTE.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEditCatColor(c)}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c, borderWidth: editCatColor === c ? 3 : 0, borderColor: '#FFFFFF' },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity onPress={() => setEditingCat(null)} style={styles.cancelAction}>
                  <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEditCategory} style={[styles.saveAction, { backgroundColor: themeColors.primary }]}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Topic Modal */}
      {editingTopic && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setEditingTopic(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Topic</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.surfaceSecondary, color: themeColors.text, borderColor: themeColors.border }]}
                value={editTopicName}
                onChangeText={setEditTopicName}
                placeholder="Topic Title"
                placeholderTextColor={themeColors.textMuted}
              />
              <View style={styles.inlineRow}>
                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Priority:</Text>
                {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setEditTopicPriority(p)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: editTopicPriority === p ? themeColors.primary : themeColors.surfaceSecondary,
                        borderColor: editTopicPriority === p ? themeColors.primary : themeColors.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: editTopicPriority === p ? '#FFF' : themeColors.text }}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity onPress={() => setEditingTopic(null)} style={styles.cancelAction}>
                  <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveEditTopic} style={[styles.saveAction, { backgroundColor: themeColors.primary }]}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

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

      {/* Category Deletion & Dependency Management Modal */}
      {catToDelete && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setCatToDelete(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                Delete Category "{catToDelete.name}"
              </Text>

              {/* Accurate Dependency Counts */}
              {catToDeleteDeps && (
                <View style={[styles.depsBox, { backgroundColor: themeColors.surfaceSecondary, borderColor: themeColors.border }]}>
                  <Text style={[styles.depsHeading, { color: themeColors.textSecondary }]}>
                    Associated Dependencies:
                  </Text>
                  <View style={styles.depsBadgeRow}>
                    <View style={[styles.depPill, { backgroundColor: '#3B82F622' }]}>
                      <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 12 }}>
                        {catToDeleteDeps.topicsCount} Topics
                      </Text>
                    </View>
                    <View style={[styles.depPill, { backgroundColor: '#F59E0B22' }]}>
                      <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 12 }}>
                        {catToDeleteDeps.tasksCount} Tasks
                      </Text>
                    </View>
                    <View style={[styles.depPill, { backgroundColor: '#8B5CF622' }]}>
                      <Text style={{ color: '#8B5CF6', fontWeight: '700', fontSize: 12 }}>
                        {catToDeleteDeps.blocksCount} Timetable Blocks
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Option A: Move Dependencies To Another Category */}
              {otherCategories.length > 0 && (
                <View style={styles.optionSection}>
                  <Text style={[styles.optionTitle, { color: themeColors.text }]}>
                    Option 1: Move Contents & Delete Category
                  </Text>
                  <Text style={[styles.optionDesc, { color: themeColors.textSecondary }]}>
                    Reassign all topics, topic tasks, and timetable blocks to:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                    {otherCategories.map((c) => {
                      const isSelected = targetMoveCatId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => setTargetMoveCatId(c.id)}
                          style={[
                            styles.targetCatPill,
                            {
                              backgroundColor: isSelected ? c.color : themeColors.surfaceSecondary,
                              borderColor: c.color,
                            },
                          ]}
                        >
                          <Text style={{ color: isSelected ? '#FFF' : themeColors.text, fontWeight: '700', fontSize: 12 }}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity
                    onPress={handleMoveAndDeleteConfirmed}
                    disabled={!targetMoveCatId}
                    style={[
                      styles.moveActionBtn,
                      { backgroundColor: targetMoveCatId ? themeColors.primary : themeColors.border },
                    ]}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                      Move Contents & Delete Category
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Option B: Destructive Cascade Delete */}
              <View style={styles.optionSection}>
                <Text style={[styles.optionTitle, { color: themeColors.danger }]}>
                  {otherCategories.length > 0 ? 'Option 2: Delete All Permanently' : 'Delete All Permanently'}
                </Text>
                <Text style={[styles.optionDesc, { color: themeColors.textMuted }]}>
                  Permanently deletes this category and all its topics, tasks, and timetable blocks.
                </Text>
                <TouchableOpacity
                  onPress={handleCascadeDeleteConfirmed}
                  style={[styles.cascadeDeleteBtn, { backgroundColor: themeColors.danger }]}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>
                    Cascade Delete All Records
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setCatToDelete(null)} style={styles.cancelModalBtn}>
                <Text style={{ color: themeColors.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelAction: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  saveAction: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  catTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  colorBlock: {
    width: 14,
    height: 14,
    borderRadius: 4,
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  iconText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  topicList: {
    gap: 8,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  activeToggle: {
    paddingHorizontal: 8,
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
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  topicControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  smallIconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  smallIconText: {
    fontSize: 10,
    fontWeight: '700',
  },
  smallEditBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  topicDeleteButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newTopicForm: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  smallAddButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addTopicLink: {
    paddingVertical: 6,
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
    marginTop: 8,
  },
  depsBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  depsHeading: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  depsBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  depPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  optionSection: {
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    marginBottom: 8,
  },
  targetCatPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  moveActionBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  cascadeDeleteBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  cancelModalBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
});
