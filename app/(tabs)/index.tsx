import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useCategoryTopicStore } from '../../src/stores/categoryTopicStore';
import { useAppTheme } from '../../src/stores/themeStore';
import { Colors } from '../../src/constants/colors';
import { TopicCard } from '../../src/components/TopicCard';
import { formatDateIST, getCurrentISTDate } from '../../src/utils/dateHelpers';

const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };

export default function DashboardScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const themeColors = Colors[theme];
  const todayStr = getCurrentISTDate();

  const { categories, topics, isLoading, loadInitialData, getTopicsByCategory } =
    useCategoryTopicStore();

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  // Categories sorted by Priority (High -> Med -> Low), then sortOrder
  const sortedCategories = [...categories].sort((a, b) => {
    const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pDiff !== 0) return pDiff;
    return a.sortOrder - b.sortOrder;
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.dateText, { color: themeColors.primary }]}>
          {formatDateIST(todayStr)} (IST)
        </Text>
        <Text style={[styles.title, { color: themeColors.text }]}>Personal Dashboard</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          Active topics grouped by category priority
        </Text>
      </View>

      {sortedCategories.map((cat) => {
        const catTopics = getTopicsByCategory(cat.id, false); // Active topics only
        if (catTopics.length === 0) return null;

        return (
          <View key={cat.id} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryPill, { backgroundColor: cat.color + '22', borderColor: cat.color }]}>
                <Text style={[styles.categoryName, { color: cat.color }]}>{cat.name}</Text>
              </View>
              <Text style={[styles.categoryPriority, { color: themeColors.textMuted }]}>
                Priority: {cat.priority.toUpperCase()}
              </Text>
            </View>

            {catTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                categoryColor={cat.color}
                onPress={() => router.push(`/topic/${topic.id}` as any)}
              />
            ))}
          </View>
        );
      })}

      {topics.filter((t) => t.isActive).length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No active topics</Text>
          <Text style={[styles.emptyBody, { color: themeColors.textSecondary }]}>
            Go to the Categories tab to add or reactivate topics for your daily dashboard.
          </Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
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
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  categorySection: {
    marginBottom: 22,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '800',
  },
  categoryPriority: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
