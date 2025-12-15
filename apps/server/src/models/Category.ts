import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Category extends Model {
  public id!: number;
  public name!: string;
  public server_id!: number;
  public position!: number;
}

Category.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  server_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { sequelize, tableName: 'categories' });