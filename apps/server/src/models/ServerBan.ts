import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ServerBan extends Model {
  public id!: number;
  public server_id!: number;
  public user_id!: number;
  public reason!: string | null;
}

ServerBan.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  server_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'server_bans' });
