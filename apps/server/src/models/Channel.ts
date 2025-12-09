import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Channel extends Model {
  public id!: number;
  public name!: string;
  public type!: 'text' | 'voice';
  public server_id!: number;
  public category_id!: number | null; // Kann null sein (Uncategorized)
  public position!: number;           // Sortierung innerhalb der Kategorie
  public custom_icon!: string | null; // Emojis oder Icon-Namen
}

Channel.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('text', 'voice'), defaultValue: 'text' },
  server_id: { type: DataTypes.INTEGER, allowNull: false },
  category_id: { type: DataTypes.INTEGER, allowNull: true },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  custom_icon: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'channels' });