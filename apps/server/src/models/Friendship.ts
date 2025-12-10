import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Friendship extends Model {
  public id!: number;
  public requester_id!: number;
  public addressee_id!: number;
  public status!: 'pending' | 'accepted' | 'blocked';
}

Friendship.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  requester_id: { type: DataTypes.INTEGER, allowNull: false },
  addressee_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'accepted', 'blocked'), defaultValue: 'pending' },
}, { sequelize, tableName: 'friendships' });