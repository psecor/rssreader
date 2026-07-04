-- CreateTable: Subscription is the access gate for API routes. Founders get
-- source='founder' with null expiresAt; store-purchased subs get source
-- 'google_play' or 'app_store' with externalId + expiresAt from webhook.
CREATE TABLE "Subscription" (
    "id"         SERIAL       NOT NULL,
    "userId"     INTEGER      NOT NULL,
    "status"     TEXT         NOT NULL,
    "source"     TEXT         NOT NULL,
    "externalId" TEXT,
    "expiresAt"  TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: 1:1 with User for the current beta scale.
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex: supports "which subs are about to expire" and status-scoped scans.
CREATE INDEX "Subscription_status_expiresAt_idx" ON "Subscription"("status", "expiresAt");

-- CreateIndex: webhook processing looks up by external Play/Apple identifier.
CREATE INDEX "Subscription_externalId_idx" ON "Subscription"("externalId");

-- AddForeignKey
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
