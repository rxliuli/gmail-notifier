import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const User = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  image: text('image'),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
  refreshToken: text('refreshToken').notNull(),
  refreshTokenExpiresAt: text('refreshTokenExpiresAt'),
})

export const Account = sqliteTable('account', {
  id: text('id').primaryKey(),
  providerId: text('providerId').notNull(), // 'google'
  providerAccountId: text('providerAccountId').notNull(), // Google sub
  userId: text('userId')
    .notNull()
    .references(() => User.id),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
})

export const Subscription = sqliteTable('subscription', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .unique()
    .references(() => User.id),
  customerId: text('customerId'),
  status: text('status', { enum: ['active', 'canceled', 'expired', 'trialing'] }).notNull(),
  currentPeriodEnd: text('currentPeriodEnd').notNull(),
  paddleSubscriptionId: text('paddleSubscriptionId'),
  paddleTransactionId: text('paddleTransactionId'),
  plan: text('plan'),
  createdAt: text('createdAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updatedAt')
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
})
