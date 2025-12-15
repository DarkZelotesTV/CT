import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcrypt';

export class User extends Model {
  public id!: number;

  // Legacy fields (optional now)
  public username!: string | null;
  public email!: string | null;
  public password_hash!: string | null;
  public avatar_url!: string | null;

  // TS3-style identity fields
  public public_key!: string | null;            // base64(32)
  public identity_fingerprint!: string | null;  // sha256(pubKey) hex
  public display_name!: string | null;

  public status!: 'online' | 'offline';

  // Password helper (legacy)
  public async checkPassword(password: string): Promise<boolean> {
    if (!this.password_hash) return false;
    return bcrypt.compare(password, this.password_hash);
  }
}

User.init({
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },

  username: { type: DataTypes.STRING(64), allowNull: true, unique: false },
  email: { type: DataTypes.STRING(190), allowNull: true, unique: false },
  password_hash: { type: DataTypes.STRING(255), allowNull: true },
  avatar_url: { type: DataTypes.STRING(512), allowNull: true },

  // Identity login
  // unique: true erstellt bereits den notwendigen Index
  public_key: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  identity_fingerprint: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  display_name: { type: DataTypes.STRING(64), allowNull: true },

  status: { type: DataTypes.ENUM('online', 'offline'), defaultValue: 'offline' }
}, {
  sequelize,
  tableName: 'users',
  hooks: {
    beforeCreate: async (user: any) => {
      if (user.password_hash && typeof user.password_hash === 'string' && !user.password_hash.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    },
    beforeUpdate: async (user: any) => {
      if (user.changed('password_hash') && user.password_hash && typeof user.password_hash === 'string' && !user.password_hash.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    }
  }
});