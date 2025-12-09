import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Server extends Model {
  public id!: number;
  public name!: string;
  public icon_url!: string;
  public owner_id!: number;
}

Server.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  icon_url: { type: DataTypes.STRING, allowNull: true },
  owner_id: { type: DataTypes.INTEGER, allowNull: false },
}, { sequelize, tableName: 'servers' });