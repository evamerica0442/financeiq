import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import api from '../api';

const CategoriesContext = createContext(null);

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const CATEGORY_ICONS = {};
  const CATEGORY_COLORS = {};

  // Build lookup maps from the categories data
  categories.forEach(c => {
    CATEGORY_ICONS[c.name] = c.icon || '📦';
    CATEGORY_COLORS[c.name] = c.color || '#8B92A5';
  });

  const fetchCategories = useCallback(async () => {
    try {
      const [catRes, groupRes] = await Promise.all([
        api.get('/categories'),
        api.get('/categories/groups'),
      ]);
      setCategories(catRes.data);
      setGroups(groupRes.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const getCategoryIcon = useCallback((catName) => {
    const found = categories.find(c => c.name === catName);
    return found?.icon || '📦';
  }, [categories]);

  const getCategoryColor = useCallback((catName) => {
    const found = categories.find(c => c.name === catName);
    return found?.color || '#8B92A5';
  }, [categories]);

  const getCategoryGroup = useCallback((catName) => {
    const found = categories.find(c => c.name === catName);
    if (!found) return null;
    return groups.find(g => g.id === found.group_id) || null;
  }, [categories, groups]);

  return (
    <CategoriesContext.Provider value={{
      categories,
      groups,
      loading,
      error,
      refresh: fetchCategories,
      getCategoryIcon,
      getCategoryColor,
      getCategoryGroup,
      CATEGORY_ICONS,
      CATEGORY_COLORS,
    }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoriesProvider');
  }
  return context;
}

export default useCategories;