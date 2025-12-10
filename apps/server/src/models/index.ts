import { User } from './User';
import { Server } from './Server';
import { Channel } from './Channel';
import { Message } from './Message';
import { ServerMember } from './ServerMember';
import { Category } from './Category';
import { Friendship } from './Friendship';

// Beziehungen definieren

// User <-> Server
User.hasMany(Server, { foreignKey: 'owner_id', as: 'ownedServers' });
Server.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

// Server <-> Channel
Server.hasMany(Channel, { foreignKey: 'server_id', as: 'channels' });
Channel.belongsTo(Server, { foreignKey: 'server_id', as: 'server' });

// Channel <-> Message
Channel.hasMany(Message, { foreignKey: 'channel_id', as: 'messages' });
Message.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });

// User <-> Message
User.hasMany(Message, { foreignKey: 'user_id', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'user_id', as: 'sender' });

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

export { User, Server, Channel, Message, ServerMember, Category, Friendship };

