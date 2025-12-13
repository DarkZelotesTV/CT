import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ChannelPermissionOverride extends Model {
  public id!: number;
  public channel_id!: number;
  public role_id!: number;
  public allow!: Record<string, boolean>;
  public deny!: Record<string, boolean>;
}

ChannelPermissionOverride.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  channel_id: { type: DataTypes.INTEGER, allowNull: false },
  role_id: { type: DataTypes.INTEGER, allowNull: false },
  allow: { type: DataTypes.JSON, defaultValue: {} },
  deny: { type: DataTypes.JSON, defaultValue: {} },
}, { sequelize, tableName: 'channel_permission_overrides' });
