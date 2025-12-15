import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ServerMember extends Model {
  public id!: number;
  public server_id!: number;
  public user_id!: number;
}

ServerMember.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  // WICHTIG: UNSIGNED
  server_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { sequelize, tableName: 'server_members' });