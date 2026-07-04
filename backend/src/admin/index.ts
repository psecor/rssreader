import { PrismaClient } from '@prisma/client';
import { updateFeed } from '../services/rssFeedService';

const prisma = new PrismaClient();

function printUsage() {
  console.error(
    `Usage:
  npm run admin -- grant-founder <email> [--name "Full Name"]
  npm run admin -- revoke <email>
  npm run admin -- list-subscriptions
  npm run admin -- force-refresh <feedId>`,
  );
}

// grant-founder is idempotent: if the user hasn't logged in yet, we pre-create
// their User row with a placeholder googleId so we have somewhere to attach the
// subscription. The Google OAuth callback resolves the placeholder by matching
// on email at first login (see auth flow in passport.ts).
async function grantFounder(args: string[]) {
  const email = args[0]?.toLowerCase();
  if (!email) {
    console.error('grant-founder requires an email');
    process.exit(1);
  }
  const nameIdx = args.indexOf('--name');
  const name = nameIdx >= 0 ? args[nameIdx + 1] ?? null : null;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, googleId: `pending:${email}`, name },
    });
    console.log(`Created placeholder User (id=${user.id}) for ${email}.`);
  }

  const sub = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: 'active',
      source: 'founder',
      expiresAt: null,
    },
    update: {
      status: 'active',
      source: 'founder',
      expiresAt: null,
      externalId: null,
    },
  });
  console.log(`Granted founder subscription (id=${sub.id}) to ${email}.`);
}

async function revoke(args: string[]) {
  const email = args[0]?.toLowerCase();
  if (!email) {
    console.error('revoke requires an email');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true },
  });
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }
  if (!user.subscription) {
    console.log(`User ${email} has no subscription; nothing to revoke.`);
    return;
  }
  await prisma.subscription.update({
    where: { userId: user.id },
    data: { status: 'cancelled', expiresAt: new Date() },
  });
  console.log(`Revoked subscription for ${email}.`);
}

async function listSubscriptions() {
  const subs = await prisma.subscription.findMany({
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (subs.length === 0) {
    console.log('No subscriptions.');
    return;
  }
  console.table(
    subs.map((s) => ({
      id: s.id,
      email: s.user.email,
      status: s.status,
      source: s.source,
      expiresAt: s.expiresAt?.toISOString().slice(0, 10) ?? '-',
      externalId: s.externalId ?? '-',
    })),
  );
}

async function forceRefresh(args: string[]) {
  const feedIdArg = args[0];
  if (!feedIdArg) {
    console.error('force-refresh requires a feedId');
    process.exit(1);
  }
  const feedId = parseInt(feedIdArg, 10);
  if (Number.isNaN(feedId)) {
    console.error(`Invalid feedId: ${feedIdArg}`);
    process.exit(1);
  }
  const result = await updateFeed(feedId);
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const [, , subcommand, ...args] = process.argv;

  switch (subcommand) {
    case 'grant-founder':
      await grantFounder(args);
      break;
    case 'revoke':
      await revoke(args);
      break;
    case 'list-subscriptions':
      await listSubscriptions();
      break;
    case 'force-refresh':
      await forceRefresh(args);
      break;
    default:
      printUsage();
      process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
