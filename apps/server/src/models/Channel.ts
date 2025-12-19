import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Channel extends Model {
  public id!: number;
  public name!: string;
  // Hier die neuen Typen zur TypeScript-Definition hinzufügen
  public type!: 'text' | 'voice' | 'web' | 'data-transfer' | 'spacer' | 'list';
  public server_id!: number;
  public category_id!: number | null;
  public position!: number;
  public custom_icon!: string | null;
  public content!: string | null;
  public default_password!: string | null;
  public join_password!: string | null;
}

Channel.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  // Hier die neuen Typen zum Sequelize ENUM hinzufügen
  type: { 
    type: DataTypes.ENUM('text', 'voice', 'web', 'data-transfer', 'spacer', 'list'), 
    defaultValue: 'text' 
  },
  // WICHTIG: Alle IDs auf UNSIGNED
  server_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  category_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  custom_icon: { type: DataTypes.STRING, allowNull: true },
  content: { type: DataTypes.TEXT, allowNull: true },
  default_password: { type: DataTypes.STRING, allowNull: true },
  join_password: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'channels' });