import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export type PermissionKey =
  | 'speak'
  | 'move'
  | 'kick'
  | 'manage_channels'
  | 'manage_roles'
  | 'manage_overrides';

export class Role extends Model {
  public id!: number;
  public server_id!: number;
  public name!: string;
  public color!: string | null;
  public position!: number;
  public permissions!: Record<PermissionKey, boolean>;
  public is_default!: boolean;
}

Role.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  server_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  color: { type: DataTypes.STRING, allowNull: true },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  permissions: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
  is_default: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, tableName: 'roles' });