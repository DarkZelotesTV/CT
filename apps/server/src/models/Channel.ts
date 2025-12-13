import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Channel extends Model {
  public id!: number;
  public name!: string;
  public type!: 'text' | 'voice' | 'web'; // 'web' hinzugefügt
  public server_id!: number;
  public category_id!: number | null;
  public position!: number;
  public custom_icon!: string | null;
  public content!: string | null; // NEU: Hier speichern wir das HTML
  public default_password!: string | null;
  public join_password!: string | null;
}

Channel.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  // ENUM erweitert:
  type: { type: DataTypes.ENUM('text', 'voice', 'web'), defaultValue: 'text' },
  server_id: { type: DataTypes.INTEGER, allowNull: false },
  category_id: { type: DataTypes.INTEGER, allowNull: true },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  custom_icon: { type: DataTypes.STRING, allowNull: true },
  // NEU: Textfeld für HTML (LONGTEXT für viel Platz)
  content: { type: DataTypes.TEXT, allowNull: true },
  default_password: { type: DataTypes.STRING, allowNull: true },
  join_password: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'channels' });