import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Server extends Model {
  public id!: number;
  public name!: string;
  public icon_url!: string;
  public owner_id!: number;
  public fallback_channel_id!: number | null;
}

Server.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  icon_url: { type: DataTypes.STRING, allowNull: true },
  owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fallback_channel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { sequelize, tableName: 'servers' });