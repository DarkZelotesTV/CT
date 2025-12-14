import { Router } from 'express';
import { Server, Channel, Message, User, ServerMember, Category, Role, MemberRole, ChannelPermissionOverride } from '../models';
import { authenticateRequest, AuthRequest } from '../middleware/authMiddleware';
import { PermissionKey } from '../models/Role';
import { Op } from 'sequelize';

const router = Router();

const PERMISSION_KEYS: PermissionKey[] = ['speak', 'move', 'kick', 'manage_channels', 'manage_roles', 'manage_overrides'];
const FULL_PERMISSIONS = PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {} as Record<PermissionKey, boolean>);

async function getUserRoles(serverId: number, userId: number) {
  return Role.findAll({
    where: { server_id: serverId },
    include: [{ model: MemberRole, as: 'memberships', where: { user_id: userId }, required: true }],
    order: [['position', 'ASC']],
  });
}

async function resolvePermissions(serverId: number, userId: number, channelId?: number) {
  const server = await Server.findByPk(serverId);
  if (!server) throw new Error('Server nicht gefunden');

  if (server.owner_id === userId) {
    return FULL_PERMISSIONS;
  }

  const roles = await getUserRoles(serverId, userId);
  const permissions: Record<PermissionKey, boolean> = PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {} as Record<PermissionKey, boolean>);

  roles.forEach((role) => {
    const perm = (role.permissions || {}) as Record<string, boolean>;
    PERMISSION_KEYS.forEach((key) => {
      if (perm[key]) permissions[key as PermissionKey] = true;
    });
  });

  if (channelId && roles.length) {
    const overrides = await ChannelPermissionOverride.findAll({
      where: { channel_id: channelId, role_id: roles.map((r) => r.id) },
    });

    overrides.forEach((override) => {
      const allow = (override.allow || {}) as Record<string, boolean>;
      const deny = (override.deny || {}) as Record<string, boolean>;
      PERMISSION_KEYS.forEach((key) => {
        if (deny[key]) permissions[key as PermissionKey] = false;
        if (allow[key]) permissions[key as PermissionKey] = true;
      });
    });
  }

  return permissions;
}

async function requirePermission(serverId: number, userId: number, permission: PermissionKey, channelId?: number) {
  const server = await Server.findByPk(serverId);
  if (!server) throw new Error('Server nicht gefunden');

  if (server.owner_id === userId) return server;

  const permissions = await resolvePermissions(serverId, userId, channelId);
  if (!permissions[permission]) {
    throw new Error('Fehlende Berechtigung');
  }

  return server;
}

async function assignDefaultRoles(serverId: number, userId: number) {
  const defaults = await Role.findAll({ where: { server_id: serverId, is_default: true } });
  if (!defaults.length) return;
  await Promise.all(defaults.map((role) => MemberRole.findOrCreate({ where: { server_id: serverId, user_id: userId, role_id: role.id }, defaults: { server_id: serverId, user_id: userId, role_id: role.id } })));
}

const statusForError = (err: any) => err?.message === 'Fehlende Berechtigung' ? 403 : 500;

// ==========================================
// SERVER ROUTES
// ==========================================

// 1. Alle Server laden (MVP: Alle existierenden)
router.get('/servers', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    // Only return servers the user is a member of. Owner is always a member on creation.
    const servers = await Server.findAll({
      include: [{ model: ServerMember, as: 'members', where: { user_id: userId }, required: true }],
      order: [['createdAt', 'ASC']],
    });
    res.json(servers);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Server" });
  }
});

// 1b. Server aktualisieren (Name/Icon) – Admin/Owner
router.put('/servers/:serverId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = req.user!.id;

    // We treat server settings as admin-only. Either manage_channels OR manage_roles is sufficient.
    const perms = await resolvePermissions(serverId, userId);
    const server = await Server.findByPk(serverId);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden' });
    if (server.owner_id !== userId && !perms.manage_channels && !perms.manage_roles) {
      return res.status(403).json({ error: 'Fehlende Berechtigung' });
    }

    const { name, icon_url } = req.body as { name?: string; icon_url?: string };
    if (typeof name === 'string' && name.trim()) server.name = name.trim();
    if (typeof icon_url === 'string') server.icon_url = icon_url;
    await server.save();

    res.json(server);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Server nicht speichern' });
  }
});

// 1c. Server löschen – nur Owner
router.delete('/servers/:serverId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = req.user!.id;

    const server = await Server.findByPk(serverId);
    if (!server) return res.status(404).json({ error: 'Server nicht gefunden' });
    if (server.owner_id !== userId) return res.status(403).json({ error: 'Fehlende Berechtigung' });

    const channels = await Channel.findAll({ where: { server_id: serverId }, attributes: ['id'] });
    const channelIds = channels.map((c: any) => c.id);

    if (channelIds.length) {
      await ChannelPermissionOverride.destroy({ where: { channel_id: { [Op.in]: channelIds } } });
      await Message.destroy({ where: { channel_id: { [Op.in]: channelIds } } });
    }

    await Channel.destroy({ where: { server_id: serverId } });
    await Category.destroy({ where: { server_id: serverId } });
    await MemberRole.destroy({ where: { server_id: serverId } });
    await Role.destroy({ where: { server_id: serverId } });
    await ServerMember.destroy({ where: { server_id: serverId } });
    await server.destroy();

    res.json({ success: true });
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Server nicht löschen' });
  }
});

// 2. Server erstellen
router.post('/servers', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const server = await Server.create({
      name,
      owner_id: req.user!.id,
      icon_url: `https://ui-avatars.com/api/?name=${name}&background=random`
    });

    // Owner automatisch als Mitglied hinzufügen
    await ServerMember.create({ server_id: server.id, user_id: req.user!.id });

    // Standard Rollen
    const ownerRole = await Role.create({ server_id: server.id, name: 'Owner', position: 0, permissions: FULL_PERMISSIONS, is_default: false });
    const memberRole = await Role.create({ server_id: server.id, name: 'Mitglied', position: 1, permissions: { speak: true }, is_default: true });
    await MemberRole.bulkCreate([
      { server_id: server.id, user_id: req.user!.id, role_id: ownerRole.id },
      { server_id: server.id, user_id: req.user!.id, role_id: memberRole.id },
    ]);

    // Standard-Kanäle erstellen
    await Channel.create({ name: 'allgemein', type: 'text', server_id: server.id });
    await Channel.create({ name: 'Lobby', type: 'voice', server_id: server.id });

    res.json(server);
  } catch (err) {
    res.status(500).json({ error: "Konnte Server nicht erstellen" });
  }
});

// 3. Server beitreten
router.post('/servers/join', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { serverId } = req.body;
    const userId = req.user!.id;

    const server = await Server.findByPk(serverId);
    if (!server) return res.status(404).json({ error: "Server nicht gefunden" });

    const existing = await ServerMember.findOne({ where: { server_id: serverId, user_id: userId } });
    if (existing) return res.status(400).json({ error: "Du bist bereits Mitglied!" });

    await ServerMember.create({ server_id: serverId, user_id: userId });
    await assignDefaultRoles(Number(serverId), userId);

    res.json({ message: "Erfolgreich beigetreten", server });
  } catch (err) {
    res.status(500).json({ error: "Konnte Server nicht beitreten" });
  }
});

// ==========================================
// STRUKTUR & CHANNELS ROUTES
// ==========================================

// 4. Komplette Server-Struktur laden (Kategorien + Kanäle)
router.get('/servers/:serverId/structure', authenticateRequest, async (req, res) => {
  try {
    const { serverId } = req.params;

    const categories = await Category.findAll({
      where: { server_id: serverId },
      order: [['position', 'ASC']],
      include: [{
        model: Channel,
        as: 'channels',
        order: [['position', 'ASC']]
      }]
    });

    const uncategorized = await Channel.findAll({
      where: { server_id: serverId, category_id: null },
      order: [['position', 'ASC']]
    });

    res.json({ categories, uncategorized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Laden der Struktur" });
  }
});

// 5. Kanal erstellen (rollenbasiert)
router.post('/servers/:serverId/channels', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name, type, categoryId, customIcon, defaultPassword, joinPassword } = req.body;
    const serverId = Number(req.params.serverId);
    const userId = req.user!.id;

    await requirePermission(serverId, userId, 'manage_channels');

    const channel = await Channel.create({
      name,
      type,
      server_id: serverId,
      category_id: categoryId || null,
      custom_icon: customIcon || null,
      default_password: defaultPassword || null,
      join_password: joinPassword || null,
    });

    res.json(channel);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || "Kanal konnte nicht erstellt werden" });
  }
});

// 5b. Kanal aktualisieren
router.put('/channels/:channelId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const channel = await Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden' });

    await requirePermission(channel.server_id, req.user!.id, 'manage_channels');

    const { name, type, categoryId, customIcon, defaultPassword, joinPassword, position } = req.body;
    if (name) channel.name = name;
    if (type) channel.type = type;
    if (typeof categoryId !== 'undefined') channel.category_id = categoryId;
    if (typeof position !== 'undefined') channel.position = position;
    channel.custom_icon = customIcon ?? channel.custom_icon;
    channel.default_password = defaultPassword ?? channel.default_password;
    channel.join_password = joinPassword ?? channel.join_password;
    await channel.save();

    res.json(channel);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Kanal nicht aktualisieren' });
  }
});

// 5c. Kanal-Reihenfolge aktualisieren
router.put('/servers/:serverId/channels/reorder', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const { updates } = req.body as { updates: { id: number; position: number; categoryId?: number | null }[] };

    await requirePermission(serverId, req.user!.id, 'manage_channels');

    await Promise.all((updates || []).map(async (u) => {
      await Channel.update({ position: u.position, category_id: u.categoryId ?? null }, { where: { id: u.id, server_id: serverId } });
    }));

    res.json({ success: true });
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Reihenfolge nicht speichern' });
  }
});

// 6. Kategorie erstellen (rollenbasiert)
router.post('/servers/:serverId/categories', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { name } = req.body;
    const serverId = Number(req.params.serverId);

    await requirePermission(serverId, req.user!.id, 'manage_channels');

    const category = await Category.create({
      name,
      server_id: Number(serverId),
      position: 999 // Ans Ende
    });
    res.json(category);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || "Kategorie Fehler" });
  }
});

// ==========================================
// MEMBER & MESSAGES ROUTES
// ==========================================

// 7. Mitgliederliste laden
router.get('/servers/:serverId/members', authenticateRequest, async (req, res) => {
  try {
    const { serverId } = req.params;
    const members = await ServerMember.findAll({
      where: { server_id: serverId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'avatar_url', 'status']
      }]
    });

    const assignments = await MemberRole.findAll({
      where: { server_id: serverId },
      include: [{ model: Role, as: 'role' }]
    });

    const rolesByUser: Record<number, any[]> = {};
    assignments.forEach((a: any) => {
      rolesByUser[a.user_id] = rolesByUser[a.user_id] || [];
      if (a.role) rolesByUser[a.user_id].push(a.role);
    });

    const cleanMembers = members.map((m: any) => ({
      userId: m.user.id,
      username: m.user.username,
      avatarUrl: m.user.avatar_url,
      status: m.user.status,
      joinedAt: m.createdAt,
      roles: rolesByUser[m.user.id] || [],
    }));

    res.json(cleanMembers);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Mitglieder" });
  }
});

// 7b. Rollen zuweisen
router.put('/servers/:serverId/members/:userId/roles', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = Number(req.params.userId);
    const { roleIds } = req.body as { roleIds: number[] };

    await requirePermission(serverId, req.user!.id, 'manage_roles');

    await MemberRole.destroy({ where: { server_id: serverId, user_id: userId } });
    await Promise.all((roleIds || []).map((roleId) => MemberRole.create({ server_id: serverId, user_id: userId, role_id: roleId })));

    res.json({ success: true });
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Rollen nicht setzen' });
  }
});

// 7c. Mitglied kicken
router.delete('/servers/:serverId/members/:userId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const userId = Number(req.params.userId);

    await requirePermission(serverId, req.user!.id, 'kick');

    await MemberRole.destroy({ where: { server_id: serverId, user_id: userId } });
    await ServerMember.destroy({ where: { server_id: serverId, user_id: userId } });

    res.json({ success: true });
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Mitglied nicht entfernen' });
  }
});

// 8. Nachrichten laden (History)
router.get('/channels/:channelId/messages', authenticateRequest, async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;
    const before = req.query.before ? new Date(String(req.query.before)) : null;

    const where: any = { channel_id: channelId };
    if (before && !isNaN(before.getTime())) {
      where.createdAt = { [Op.lt]: before };
    }

    const messages = await Message.findAll({
      where,
      include: [{ model: User, as: 'sender', attributes: ['username', 'avatar_url', 'id'] }],
      order: [['createdAt', 'DESC']],
      limit: limit + 1,
    });

    const hasMore = messages.length > limit;
    const limited = hasMore ? messages.slice(0, limit) : messages;

    res.json({ messages: limited.reverse(), hasMore });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden der Nachrichten" });
  }
});

// CHANNEL CONTENT LOAD (Für Web-Channels)
router.get('/channels/:channelId/content', authenticateRequest, async (req, res) => {
  try {
    const channelId = req.params.channelId;
    const channel = await Channel.findByPk(channelId);

    if (!channel) {
      return res.status(404).json({ error: "Kanal nicht gefunden" });
    }

    res.json({ content: channel.content });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden des Inhalts" });
  }
});

// CHANNEL CONTENT UPDATE (Für Web-Channels)
router.put('/channels/:channelId/content', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;
    const channelId = req.params.channelId;
    const userId = req.user!.id;

    const channel = await Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ error: "Kanal nicht gefunden" });

    await requirePermission(channel.server_id, userId, 'manage_channels');

    channel.content = content;
    await channel.save();

    res.json(channel);
  } catch (err) {
    res.status(statusForError(err)).json({ error: (err as any)?.message || "Konnte Inhalt nicht speichern" });
  }
});

// ==========================================
// ROLLEN & BERECHTIGUNGEN
// ==========================================

router.get('/servers/:serverId/roles', authenticateRequest, async (req, res) => {
  try {
    const roles = await Role.findAll({ where: { server_id: req.params.serverId }, order: [['position', 'ASC']] });
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Fehler beim Laden der Rollen' });
  }
});

router.post('/servers/:serverId/roles', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    await requirePermission(serverId, req.user!.id, 'manage_roles');

    const { name, color, position, permissions, isDefault } = req.body;
    const role = await Role.create({ server_id: serverId, name, color: color || null, position: position ?? 999, permissions: permissions || {}, is_default: !!isDefault });
    res.json(role);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Rolle nicht erstellen' });
  }
});

router.put('/servers/:serverId/roles/:roleId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const { roleId } = req.params;

    await requirePermission(serverId, req.user!.id, 'manage_roles');

    const role = await Role.findOne({ where: { id: roleId, server_id: serverId } });
    if (!role) return res.status(404).json({ error: 'Rolle nicht gefunden' });

    const { name, color, position, permissions, isDefault } = req.body;
    if (name) role.name = name;
    if (typeof color !== 'undefined') role.color = color;
    if (typeof position !== 'undefined') role.position = position;
    if (permissions) role.permissions = permissions;
    if (typeof isDefault !== 'undefined') role.is_default = isDefault;
    await role.save();

    res.json(role);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Rolle nicht aktualisieren' });
  }
});

router.delete('/servers/:serverId/roles/:roleId', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const serverId = Number(req.params.serverId);
    const { roleId } = req.params;

    await requirePermission(serverId, req.user!.id, 'manage_roles');

    const role = await Role.findOne({ where: { id: roleId, server_id: serverId } });
    if (!role) return res.status(404).json({ error: 'Rolle nicht gefunden' });
    if (role.is_default) return res.status(400).json({ error: 'Standardrolle kann nicht gelöscht werden' });

    await MemberRole.destroy({ where: { role_id: roleId } });
    await role.destroy();

    res.json({ success: true });
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Rolle nicht löschen' });
  }
});

// Overrides pro Kanal
router.get('/channels/:channelId/overrides', authenticateRequest, async (req, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const overrides = await ChannelPermissionOverride.findAll({
      where: { channel_id: channelId },
      include: [{ model: Role, as: 'role' }],
    });
    res.json(overrides);
  } catch (err) {
    res.status(statusForError(err)).json({ error: (err as any)?.message || 'Fehler beim Laden der Overrides' });
  }
});

router.put('/channels/:channelId/overrides', authenticateRequest, async (req: AuthRequest, res) => {
  try {
    const channelId = Number(req.params.channelId);
    const channel = await Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ error: 'Kanal nicht gefunden' });

    await requirePermission(channel.server_id, req.user!.id, 'manage_overrides', channelId);

    const { roleId, allow, deny } = req.body as { roleId: number; allow?: Record<string, boolean>; deny?: Record<string, boolean> };
    const [override] = await ChannelPermissionOverride.findOrCreate({
      where: { channel_id: channelId, role_id: roleId },
      defaults: { channel_id: channelId, role_id: roleId, allow: allow || {}, deny: deny || {} },
    });

    override.allow = allow ?? override.allow;
    override.deny = deny ?? override.deny;
    await override.save();

    res.json(override);
  } catch (err: any) {
    res.status(statusForError(err)).json({ error: err?.message || 'Konnte Overrides nicht speichern' });
  }
});

export default router;