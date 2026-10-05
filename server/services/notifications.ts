import nodemailer from "nodemailer";
import { and, eq } from "drizzle-orm";
import { notificationOutbox, notifications, type User } from "../../drizzle/schema";

export type NotificationPayload = {
  recipient: User;
  requestId?: number;
  eventType: string;
  dedupeKey: string;
  title: string;
  body: string;
};

export async function queueNotifications(db: any, items: NotificationPayload[]) {
  for (const item of items) {
    await db.insert(notifications).values({
      recipientId: item.recipient.id,
      requestId: item.requestId ?? null,
      type: item.eventType,
      title: item.title,
      body: item.body,
    });

    await db.insert(notificationOutbox).values({
      requestId: item.requestId ?? null,
      recipientId: item.recipient.id,
      eventType: item.eventType,
      dedupeKey: item.dedupeKey,
      recipientEmail: item.recipient.email ?? null,
      subject: item.title,
      body: item.body,
    }).onDuplicateKeyUpdate({ set: { body: item.body, subject: item.title } });
  }
}

export async function markNotificationRead(db: any, notificationId: number, recipientId: number) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, recipientId)));
}

export async function deliverPendingEmail(outbox: typeof notificationOutbox.$inferSelect) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !from || !outbox.recipientEmail) return { delivered: false, reason: "smtp_not_configured" as const };

  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: user && password ? { user, pass: password } : undefined });
  await transporter.sendMail({ from, to: outbox.recipientEmail, subject: outbox.subject, text: outbox.body });
  return { delivered: true as const };
}
