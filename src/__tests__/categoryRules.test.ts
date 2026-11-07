import { useCategoryTopicStore } from '../stores/categoryTopicStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Category Rules & Cascade Deletions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await useCategoryTopicStore.getState().loadInitialData();
  });

  it('should calculate topic progress accurately', async () => {
    const store = useCategoryTopicStore.getState();
    const topicId = 'top_career_1';

    // Initially 0 tasks
    let progress = store.getTopicProgress(topicId);
    expect(progress.total).toBe(0);
    expect(progress.percentage).toBe(0);

    // Add 2 tasks
    const t1 = await store.addTask(topicId, 'Task 1');
    const t2 = await store.addTask(topicId, 'Task 2');

    progress = useCategoryTopicStore.getState().getTopicProgress(topicId);
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(0);
    expect(progress.percentage).toBe(0);

    // Complete 1 task
    await useCategoryTopicStore.getState().toggleTaskComplete(t1.id);
    progress = useCategoryTopicStore.getState().getTopicProgress(topicId);
    expect(progress.completed).toBe(1);
    expect(progress.percentage).toBe(50);
  });

  it('should cascade delete topics and tasks when category is deleted', async () => {
    const store = useCategoryTopicStore.getState();
    const targetCatId = 'cat_career';

    // Add task under topic in Career
    await store.addTask('top_career_1', 'Resume polish');

    // Trigger cascade deletion
    await useCategoryTopicStore.getState().deleteCategoryCascade(targetCatId);

    const state = useCategoryTopicStore.getState();
    // Category should be gone
    expect(state.categories.find((c) => c.id === targetCatId)).toBeUndefined();
    // Topics under category should be gone
    expect(state.topics.find((t) => t.categoryId === targetCatId)).toBeUndefined();
    // Tasks under those topics should be gone
    expect(state.topicTasks.find((task) => task.topicId === 'top_career_1')).toBeUndefined();
  });

  it('should move category contents cleanly before deleting category', async () => {
    const store = useCategoryTopicStore.getState();
    const fromCat = 'cat_interests';
    const toCat = 'cat_entertainment';

    await useCategoryTopicStore.getState().moveCategoryContentsAndDelete(fromCat, toCat);

    const state = useCategoryTopicStore.getState();
    // fromCat should be gone
    expect(state.categories.find((c) => c.id === fromCat)).toBeUndefined();
    // Topics formerly under fromCat should now point to toCat
    const movedTopic = state.topics.find((t) => t.id === 'top_int_1');
    expect(movedTopic).toBeDefined();
    expect(movedTopic?.categoryId).toBe(toCat);
  });
});
