import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Server extends Model {
  public id!: number;
  public name!: string;
  public icon_url!: string | null;
  public owner_id!: number;
  public fallback_channel_id!: number | null;
  public drag_drop_enabled!: boolean;
}

Server.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  icon_url: { type: DataTypes.STRING, allowNull: true },
  owner_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  fallback_channel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  drag_drop_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { sequelize, tableName: 'servers' });
