import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class MemberRole extends Model {
  public id!: number;
  public server_id!: number;
  public user_id!: number;
  public role_id!: number;
}

MemberRole.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  server_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  role_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { sequelize, tableName: 'server_member_roles' });