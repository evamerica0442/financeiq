import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import BottomSheet from '../components/ui/BottomSheet';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { useToast } from '../hooks/useToast';

const ICON_OPTIONS = ['🏠', '🛒', '🍽️', '🚗', '⛽', '💊', '🏥', '🛡️', '🎬', '📱', '💡', '🏢', '📚', '💰', '📈', '💵', '📦', '🎯', '🛍️', '✈️', '🎮', '🎵', '👕', '🐾', '💼'];
const COLOR_OPTIONS = ['#4D9FFF', '#00C896', '#FFAB2E', '#FF6B6B', '#FF5C5C', '#9B7FFF', '#FF8ED4', '#F7AEF8', '#74B9FF', '#1ABC9C', '#E74C3C', '#8E44AD', '#2ECC71', '#3498DB', '#8B92A5'];

export default function Categories() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formType, setFormType] = useState('category'); // 'group' or 'category'
  const [formData, setFormData] = useState({ name: '', group_id: null, icon: '📦', color: '#8B92A5' });
  const [formError, setFormError] = useState('');
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [addingToGroup, setAddingToGroup] = useState(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/categories/groups');
      setGroups(res.data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openAddCategory(groupId) {
    setFormType('category');
    setEditingCategory(null);
    setFormData({ name: '', group_id: groupId, icon: '📦', color: '#8B92A5' });
    setFormError('');
    setAddingToGroup(groupId);
    setShowSheet(true);
  }

  function openAddGroup() {
    setFormType('group');
    setEditingGroup(null);
    setEditingCategory(null);
    setFormData({ name: '', icon: '📦', color: '#8B92A5' });
    setFormError('');
    setAddingToGroup(null);
    setShowSheet(true);
  }

  function openEditCategory(cat) {
    setFormType('category');
    setEditingCategory(cat);
    setFormData({ name: cat.name, group_id: cat.group_id, icon: cat.icon || '📦', color: cat.color || '#8B92A5' });
    setFormError('');
    setAddingToGroup(cat.group_id);
    setShowSheet(true);
  }

  function openEditGroup(group) {
    setFormType('group');
    setEditingGroup(group);
    setEditingCategory(null);
    setFormData({ name: group.name, icon: group.icon || '📦', color: group.color || '#8B92A5' });
    setFormError('');
    setAddingToGroup(null);
    setShowSheet(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.name) {
      setFormError('Name is required.');
      return;
    }

    try {
      if (formType === 'group') {
        if (editingGroup) {
          await api.put(`/categories/groups/${editingGroup.id}`, formData);
          addToast('Group updated', 'success');
        } else {
          await api.post('/categories/groups', formData);
          addToast('Group created', 'success');
        }
      } else {
        if (editingCategory) {
          await api.put(`/categories/${editingCategory.id}`, formData);
          addToast('Category updated', 'success');
        } else {
          await api.post('/categories', formData);
          addToast('Category created', 'success');
        }
      }
      setShowSheet(false);
      fetchData();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save.');
    }
  }

  async function handleDeleteGroup(id) {
    try {
      await api.delete(`/categories/groups/${id}`);
      addToast('Group deleted', 'info');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete group', 'error');
    }
  }

  async function handleDeleteCategory(id) {
    try {
      await api.delete(`/categories/${id}`);
      addToast('Category deleted', 'info');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to delete category', 'error');
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <Skeleton variant="title" className="mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} variant="card" height="120px" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-on-mount">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Categories</h1>
          <p className="text-sm text-[var(--text-secondary)]">{groups.length} groups · {groups.reduce((s, g) => s + (g.categories?.length || 0), 0)} categories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openAddGroup}>+ Group</Button>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map(group => {
          const isExpanded = expandedGroup === group.id;
          return (
            <Card key={group.id} hover className="overflow-hidden">
              {/* Group Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: (group.color || '#8B92A5') + '20' }}
                  >
                    {group.icon || '📦'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm">{group.name}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">{group.categories?.length || 0} categories</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditGroup(group); }}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    aria-label="Edit group"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                    className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    aria-label="Delete group"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <svg className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Categories List (expandable) */}
              {isExpanded && (
                <div className="mt-4 pt-3 border-t border-[var(--border)] animate-on-mount">
                  <div className="space-y-1">
                    {group.categories?.length > 0 ? group.categories.map(cat => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors group/item"
                      >
                        <div className="flex items-center gap-2">
                          <span>{cat.icon || '📦'}</span>
                          <span className="text-sm text-[var(--text-primary)]">{cat.name}</span>
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: cat.color || '#8B92A5' }} />
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditCategory(cat)}
                            className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
                            aria-label="Edit category"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--accent-red)] transition-colors"
                            aria-label="Delete category"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-[var(--text-secondary)] py-2 text-center">No categories in this group</p>
                    )}
                  </div>
                  <button
                    onClick={() => openAddCategory(group.id)}
                    className="mt-2 w-full py-2 rounded-xl text-xs font-medium text-[var(--accent-green)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    + Add category
                  </button>
                </div>
              )}
            </Card>
          );
        })}

        {/* Add Group Card */}
        <div
          onClick={openAddGroup}
          className="rounded-2xl border-2 border-dashed border-[var(--border)] p-6 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--accent-green)] hover:bg-[var(--bg-tertiary)] transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-2 text-xl group-hover:bg-[var(--accent-green)]/10 transition-colors">
            <span className="text-[var(--text-secondary)] group-hover:text-[var(--accent-green)]">+</span>
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--accent-green)] transition-colors">Create new group</p>
        </div>
      </div>

      {/* Bottom Sheet */}
      <BottomSheet
        isOpen={showSheet}
        onClose={() => setShowSheet(false)}
        title={formType === 'group'
          ? (editingGroup ? 'Edit Group' : 'Create Group')
          : (editingCategory ? 'Edit Category' : 'Add Category')}
      >
        {formError && (
          <div className="mb-4 p-3 bg-[var(--accent-red)]/10 border border-[var(--accent-red)]/20 text-[var(--accent-red)] rounded-xl text-sm">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder={formType === 'group' ? 'e.g. Shopping' : 'e.g. Clothing'}
            required
          />

          {/* Icon Picker */}
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Icon</p>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
              {ICON_OPTIONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormData({...formData, icon})}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${
                    formData.icon === icon
                      ? 'bg-[var(--accent-green)] text-[#0D0F14] ring-2 ring-[var(--accent-green)]'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({...formData, color})}
                  className={`w-8 h-8 rounded-full transition-all ${
                    formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--bg-primary)] scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowSheet(false)}>
              Cancel
            </Button>
            <Button type="submit" fullWidth disabled={!formData.name}>
              {editingCategory || editingGroup ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}