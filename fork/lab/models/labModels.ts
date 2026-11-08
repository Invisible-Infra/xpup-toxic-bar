/**
 * XPUP-LAB: Lab-specific Sequelize models (orders, tickets, uploads, tokens, coupons).
 */
import {
  Model,
  DataTypes,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize
} from 'sequelize'

export class LabOrder extends Model<InferAttributes<LabOrder>, InferCreationAttributes<LabOrder>> {
  declare id: CreationOptional<number>
  declare publicId: string
  declare UserId: number
  declare status: string
  declare total: number
  declare paidAmount: number
  declare unitPrice: number
  declare quantity: number
  declare deliveryPrice: number
  declare couponDiscount: number
  declare addressId: number | null
  declare deliveryMethodId: number | null
  declare refunded: CreationOptional<boolean>
  declare ProductId: number
}

export class SupportTicket extends Model<InferAttributes<SupportTicket>, InferCreationAttributes<SupportTicket>> {
  declare id: CreationOptional<number>
  declare UserId: number
  declare message: string
  declare uploadHandle: string | null
  declare previewUrl: string | null
  declare previewTitle: string | null
}

export class LabUpload extends Model<InferAttributes<LabUpload>, InferCreationAttributes<LabUpload>> {
  declare id: CreationOptional<number>
  declare handle: string
  declare UserId: number
  declare originalName: string
  declare storedName: string
  declare declaredMime: string
  declare size: number
  declare previewStatus: string
}

export class PasswordResetToken extends Model<InferAttributes<PasswordResetToken>, InferCreationAttributes<PasswordResetToken>> {
  declare id: CreationOptional<number>
  declare UserId: number
  declare token: string
  declare expiresAt: Date
  declare invalidated: CreationOptional<boolean>
}

export class CouponRedemption extends Model<InferAttributes<CouponRedemption>, InferCreationAttributes<CouponRedemption>> {
  declare id: CreationOptional<number>
  declare UserId: number
  declare code: string
  declare BasketId: number | null
  declare amount: number
}

export class SessionRecord extends Model<InferAttributes<SessionRecord>, InferCreationAttributes<SessionRecord>> {
  declare id: CreationOptional<number>
  declare tokenHash: string
  declare UserId: number
  declare expiresAt: Date
  declare revoked: CreationOptional<boolean>
  declare issuedAt: Date
}

export class TotpFailure extends Model<InferAttributes<TotpFailure>, InferCreationAttributes<TotpFailure>> {
  declare id: CreationOptional<number>
  declare UserId: number
  declare createdAt: CreationOptional<Date>
}

export class TotpUsedStep extends Model<InferAttributes<TotpUsedStep>, InferCreationAttributes<TotpUsedStep>> {
  declare id: CreationOptional<number>
  declare UserId: number
  declare step: number
}

export class TotpChallenge extends Model<InferAttributes<TotpChallenge>, InferCreationAttributes<TotpChallenge>> {
  declare id: CreationOptional<number>
  declare jti: string
  declare UserId: number
  declare invalidated: CreationOptional<boolean>
}

export function initLabModels (sequelize: Sequelize) {
  LabOrder.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    publicId: { type: DataTypes.STRING, unique: true, allowNull: false },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'draft' },
    total: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    paidAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    unitPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    deliveryPrice: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 20 },
    couponDiscount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    addressId: { type: DataTypes.INTEGER, allowNull: true },
    deliveryMethodId: { type: DataTypes.INTEGER, allowNull: true },
    refunded: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ProductId: { type: DataTypes.INTEGER, allowNull: false }
  }, { tableName: 'LabOrders', sequelize })

  SupportTicket.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    uploadHandle: { type: DataTypes.STRING, allowNull: true },
    previewUrl: { type: DataTypes.STRING, allowNull: true },
    previewTitle: { type: DataTypes.STRING, allowNull: true }
  }, { tableName: 'SupportTickets', sequelize })

  LabUpload.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    handle: { type: DataTypes.STRING, unique: true, allowNull: false },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    originalName: { type: DataTypes.STRING, allowNull: false },
    storedName: { type: DataTypes.STRING, allowNull: false },
    declaredMime: { type: DataTypes.STRING, allowNull: false },
    size: { type: DataTypes.INTEGER, allowNull: false },
    previewStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' }
  }, { tableName: 'LabUploads', sequelize })

  PasswordResetToken.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    token: { type: DataTypes.STRING, unique: true, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    invalidated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, { tableName: 'PasswordResetTokens', sequelize })

  CouponRedemption.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    BasketId: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 20 }
  }, { tableName: 'CouponRedemptions', sequelize })

  SessionRecord.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tokenHash: { type: DataTypes.STRING, unique: true, allowNull: false },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    issuedAt: { type: DataTypes.DATE, allowNull: false }
  }, { tableName: 'SessionRecords', sequelize })

  TotpFailure.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'TotpFailures', sequelize, timestamps: false })

  TotpUsedStep.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    step: { type: DataTypes.INTEGER, allowNull: false }
  }, { tableName: 'TotpUsedSteps', sequelize, indexes: [{ unique: true, fields: ['UserId', 'step'] }] })

  TotpChallenge.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    jti: { type: DataTypes.STRING, unique: true, allowNull: false },
    UserId: { type: DataTypes.INTEGER, allowNull: false },
    invalidated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, { tableName: 'TotpChallenges', sequelize })
}
