import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ServerMember extends Model {
  public id!: number;
  public server_id!: number;
  public user_id!: number;
}

ServerMember.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  server_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
}, { sequelize, tableName: 'server_members' });