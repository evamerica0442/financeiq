const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Ensure a user has their own set of global categories copied.
 * Called implicitly when a user accesses categories for the first time.
 */
async function ensureUserCategories(client, userId) {
  const existing = await client.query(
    'SELECT id FROM category_groups WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  if (existing.rows.length > 0) return; // Already has per-user groups

  // Copy global groups
  const groupsResult = await client.query(
    `INSERT INTO category_groups (name, icon, color, sort_order, user_id)
     SELECT name, icon, color, sort_order, $1 FROM category_groups WHERE user_id IS NULL
     ON CONFLICT (name, COALESCE(user_id, 0)) DO NOTHING
     RETURNING id, name`,
    [userId]
  );
  const groupMap = {};
  for (const row of groupsResult.rows) {
    const oldGroup = await client.query(
      'SELECT id FROM category_groups WHERE name = $1 AND user_id IS NULL',
      [row.name]
    );
    groupMap[oldGroup.rows[0]?.id] = row.id;
  }

  // Copy categories
  const cats = await client.query('SELECT * FROM categories WHERE user_id IS NULL');
  for (const cat of cats.rows) {
    const newGroupId = groupMap[cat.group_id];
    if (!newGroupId) continue;
    await client.query(
      `INSERT INTO categories (name, group_id, icon, color, sort_order, type, user_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (name, COALESCE(user_id, 0)) DO NOTHING`,
      [cat.name, newGroupId, cat.icon, cat.color, cat.sort_order, cat.type || 'expense', userId]
    );
  }
}

// ─── GET /api/categories/groups — all groups with their categories for the user
router.get('/groups', async (req, res) => {
  try {
    await ensureUserCategories(pool, req.user.id);

    const groupsResult = await pool.query(
      'SELECT * FROM category_groups WHERE user_id = $1 ORDER BY sort_order, name',
      [req.user.id]
    );
    const groups = groupsResult.rows;

    // Attach active categories to each group
    for (const group of groups) {
      const catResult = await pool.query(
        'SELECT * FROM categories WHERE group_id = $1 AND is_active = TRUE ORDER BY sort_order, name',
        [group.id]
      );
      group.categories = catResult.rows;
    }

    res.json(groups);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: 'Failed to fetch category groups.' });
  }
});

// ─── GET /api/categories — flat list of all active categories for the user
router.get('/', async (req, res) => {
  try {
    await ensureUserCategories(pool, req.user.id);

    const result = await pool.query(
      `SELECT c.*, g.name as group_name, g.icon as group_icon, g.color as group_color
       FROM categories c
       JOIN category_groups g ON c.group_id = g.id
       WHERE c.user_id = $1 AND c.is_active = TRUE
       ORDER BY g.sort_order, c.sort_order, c.name`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// ─── POST /api/categories/groups — create a new group for the user
router.post('/groups', async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    const result = await pool.query(
      `INSERT INTO category_groups (name, icon, color, user_id)
       VALUES ($1, $2, COALESCE($3, '#8B92A5'), $4)
       RETURNING *`,
      [name, icon || '📦', color, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A group with that name already exists.' });
    }
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create category group.' });
  }
});

// ─── POST /api/categories — create a new category for the user
router.post('/', async (req, res) => {
  try {
    const { name, group_id, icon, color, type } = req.body;
    if (!name || !group_id) {
      return res.status(400).json({ error: 'Category name and group_id are required.' });
    }

    // Verify the group belongs to this user
    const groupCheck = await pool.query(
      'SELECT id FROM category_groups WHERE id = $1 AND user_id = $2',
      [group_id, req.user.id]
    );
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category group not found.' });
    }

    const result = await pool.query(
      `INSERT INTO categories (name, group_id, icon, color, type, user_id, is_active)
       VALUES ($1, $2, COALESCE($3, '📦'), COALESCE($4, '#8B92A5'), COALESCE($5, 'expense'), $6, TRUE)
       RETURNING *`,
      [name, group_id, icon, color, type || 'expense', req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    console.error('Create category error:', err);
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// ─── PUT /api/categories/groups/:id — update a group
router.put('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, sort_order } = req.body;

    const result = await pool.query(
      `UPDATE category_groups
       SET name = COALESCE($1, name),
           icon = COALESCE($2, icon),
           color = COALESCE($3, color),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, icon, color, sort_order, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A group with that name already exists.' });
    }
    console.error('Update group error:', err);
    res.status(500).json({ error: 'Failed to update group.' });
  }
});

// ─── PUT /api/categories/:id — update a category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, group_id, icon, color, sort_order, type, is_active } = req.body;

    // Build dynamic update — only set provided fields
    const updates = [];
    const params = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (group_id !== undefined) { updates.push(`group_id = $${idx++}`); params.push(group_id); }
    if (icon !== undefined) { updates.push(`icon = $${idx++}`); params.push(icon); }
    if (color !== undefined) { updates.push(`color = $${idx++}`); params.push(color); }
    if (sort_order !== undefined) { updates.push(`sort_order = $${idx++}`); params.push(sort_order); }
    if (type !== undefined) { updates.push(`type = $${idx++}`); params.push(type); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id, req.user.id);
    const result = await pool.query(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A category with that name already exists.' });
    }
    console.error('Update category error:', err);
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

// ─── DELETE /api/categories/groups/:id — delete a group (soft by reassigning user's categories)
router.delete('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reassignToGroupId } = req.body;

    // Verify the group belongs to this user
    const groupCheck = await pool.query(
      'SELECT name FROM category_groups WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    // Get categories in this group
    const cats = await pool.query(
      'SELECT id, name FROM categories WHERE group_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (cats.rows.length > 0) {
      if (reassignToGroupId) {
        // Verify target group exists and belongs to user
        const targetCheck = await pool.query(
          'SELECT id FROM category_groups WHERE id = $1 AND user_id = $2',
          [reassignToGroupId, req.user.id]
        );
        if (targetCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Target group not found.' });
        }
        // Reassign categories to target group
        await pool.query(
          'UPDATE categories SET group_id = $1 WHERE group_id = $2 AND user_id = $3',
          [reassignToGroupId, id, req.user.id]
        );
      } else {
        return res.status(409).json({
          error: `This group has ${cats.rows.length} categor${cats.rows.length === 1 ? 'y' : 'ies'}. Provide reassignToGroupId to move them, or delete/reassign them first.`
        });
      }
    }

    const result = await pool.query(
      'DELETE FROM category_groups WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    res.json({ message: 'Group deleted successfully.' });
  } catch (err) {
    console.error('Delete group error:', err);
    res.status(500).json({ error: 'Failed to delete group.' });
  }
});

// ─── DELETE /api/categories/:id — soft-delete (archive) a category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reassignToCategoryId } = req.body;

    // Verify ownership
    const catCheck = await pool.query(
      'SELECT id, name FROM categories WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (catCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found.' });
    }

    // If reassign requested, move transactions before archiving
    if (reassignToCategoryId) {
      const targetCheck = await pool.query(
        'SELECT id FROM categories WHERE id = $1 AND user_id = $2',
        [reassignToCategoryId, req.user.id]
      );
      if (targetCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Target category not found.' });
      }
      await pool.query(
        'UPDATE transactions SET category_id = $1 WHERE category_id = $2 AND user_id = $3',
        [reassignToCategoryId, id, req.user.id]
      );
    }

    // Soft-delete by setting is_active = FALSE
    await pool.query(
      'UPDATE categories SET is_active = FALSE WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    res.json({ message: 'Category archived successfully.' });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

module.exports = router;