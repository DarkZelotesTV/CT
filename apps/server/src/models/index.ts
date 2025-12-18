import { User } from './User';
import { Server } from './Server';
import { Channel } from './Channel';
import { ServerMember } from './ServerMember';
import { Category } from './Category';
import { Friendship } from './Friendship';
import { Role } from './Role';
import { MemberRole } from './MemberRole';
import { ChannelPermissionOverride } from './ChannelPermissionOverride';
import { ServerBan } from './ServerBan';

// Beziehungen definieren

// User <-> Server
User.hasMany(Server, { foreignKey: 'owner_id', as: 'ownedServers' });
Server.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Server.hasMany(ServerBan, { foreignKey: 'server_id', as: 'bans' });
ServerBan.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

// Server <-> Channel
Server.hasMany(Channel, { foreignKey: 'server_id', as: 'channels' });
Channel.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

// NEU: Server <-> Member Beziehung
Server.hasMany(ServerMember, { foreignKey: 'server_id', as: 'members' });
ServerMember.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

User.hasMany(ServerMember, { foreignKey: 'user_id', as: 'memberships' });
ServerMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Server <-> Category
Server.hasMany(Category, { foreignKey: 'server_id', as: 'categories' });
Category.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

// Category <-> Channel
Category.hasMany(Channel, { foreignKey: 'category_id', as: 'channels' });
Channel.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// User <-> Friendship
User.hasMany(Friendship, { foreignKey: 'requester_id', as: 'sentRequests' });
User.hasMany(Friendship, { foreignKey: 'addressee_id', as: 'receivedRequests' });

// Server <-> Role
Server.hasMany(Role, { foreignKey: 'server_id', as: 'roles' });
Role.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

// Role <-> MemberRole
Role.hasMany(MemberRole, { foreignKey: 'role_id', as: 'memberships' });
MemberRole.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
User.hasMany(MemberRole, { foreignKey: 'user_id', as: 'roleMemberships' });
MemberRole.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Server.hasMany(MemberRole, { foreignKey: 'server_id', as: 'roleAssignments' });
MemberRole.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

// Channel overrides
Channel.hasMany(ChannelPermissionOverride, { foreignKey: 'channel_id', as: 'overrides' });
ChannelPermissionOverride.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });
Role.hasMany(ChannelPermissionOverride, { foreignKey: 'role_id', as: 'roleOverrides' });
ChannelPermissionOverride.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

export { User, Server, Channel, ServerMember, Category, Friendship, Role, MemberRole, ChannelPermissionOverride, ServerBan };
