import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Message extends Model {
  public id!: number;
  public content!: string;
  public user_id!: number;
  public channel_id!: number;
  public createdAt!: Date;
}

Message.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  content: { type: DataTypes.TEXT, allowNull: false },
  // WICHTIG: UNSIGNED
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  channel_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
}, { sequelize, tableName: 'messages' });