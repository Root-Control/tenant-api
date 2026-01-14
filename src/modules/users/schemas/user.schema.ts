import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BaseDocument } from '../../../common/mongo/base.document';

export type UserDocument = User & BaseDocument;

export enum MigrationStatus {
  NON_MIGRATED = 'non-migrated',
  MIGRATED = 'migrated',
}

export enum ProviderName {
  LEGACY = 'legacy',
  WORKOS = 'workos',
  AUTH0 = 'auth0',
}

@Schema({
  collection: 'users',
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  toJSON: {
    transform: (doc: any, ret: any) => {
      delete ret.password_hash;
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: (doc: any, ret: any) => {
      delete ret.password_hash;
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class User {
  _id: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({
    type: String,
    required: true,
    select: false,
  })
  password_hash: string;

  @Prop({
    type: String,
    enum: MigrationStatus,
    default: MigrationStatus.NON_MIGRATED,
  })
  migration_status: MigrationStatus;

  @Prop({
    type: String,
    default: null,
  })
  provider_user_id: string | null;

  @Prop({
    type: String,
    enum: ProviderName,
    default: ProviderName.LEGACY,
  })
  provider_name: ProviderName;

  @Prop({
    type: Date,
    default: null,
  })
  migration_date: Date | null;

  @Prop({
    type: Boolean,
    default: true,
  })
  enabled: boolean;

  @Prop({
    type: Date,
    default: null,
  })
  deleted_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
