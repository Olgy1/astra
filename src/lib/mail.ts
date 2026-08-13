import nodemailer, { type Transporter } from "nodemailer";
import { isMailConfigured, serverEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import type { EmailType } from "@prisma/client";

/**
 * Envoi d'emails transactionnels — service centralisé.
 *
 * Si SMTP_HOST est absent, les emails sont écrits dans la console au lieu
 * d'être envoyés. C'est le mode par défaut en développement : le lien de
 * vérification est cliquable depuis le terminal, sans avoir à brancher un
 * serveur SMTP pour créer un compte de test.
 *
 * Chaque envoi (réussi ou non) est tracé dans `email_logs` : qui a reçu quoi,
 * quand, et avec quel résultat. La ligne est créée AVANT l'envoi (statut
 * PENDING) puis passée à SENT ou FAILED — une trace existe même si le
 * processus meurt en plein envoi. On ne stocke jamais le contenu sensible :
 * uniquement le destinataire, le type, le sujet et l'issue.
 */

const globalForMail = globalThis as unknown as {
  mailer: Transporter | undefined;
};

function transporter(): Transporter {
  if (globalForMail.mailer) return globalForMail.mailer;

  const env = serverEnv();

  const created = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // Le port 465 est en TLS implicite, les autres (587, 25) négocient
    // STARTTLS après connexion.
    secure: env.SMTP_PORT === 465,
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });

  globalForMail.mailer = created;
  return created;
}

type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Type d'email, enregistré dans email_logs. */
  type: EmailType;
  /** Propriétaire du compte destinataire, si connu (tracé dans email_logs). */
  userId?: string;
};

async function send(mail: Mail): Promise<void> {
  // Ligne d'historique créée avant l'envoi : même en cas de crash, la trace
  // existe (statut PENDING). Le sujet est stocké, jamais le corps ni les
  // tokens — pas de fuite possible depuis l'historique.
  const log = await prisma.emailLog.create({
    data: {
      userId: mail.userId,
      email: mail.to,
      type: mail.type,
      subject: mail.subject,
      status: "PENDING",
    },
  });

  if (!isMailConfigured()) {
    console.log(
      [
        "",
        "┌─ EMAIL (mode développement, non envoyé) ────────────────",
        `│ À       : ${mail.to}`,
        `│ Sujet   : ${mail.subject}`,
        "├──────────────────────────────────────────────────────────",
        ...mail.text.split("\n").map((line) => `│ ${line}`),
        "└──────────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "SENT" },
    });
    return;
  }

  try {
    const info = await transporter().sendMail({
      from: serverEnv().SMTP_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        // Identifiant du fournisseur, tronqué à la largeur de la colonne.
        providerMessageId: info.messageId?.slice(0, 255) ?? null,
      },
    });
  } catch (error) {
    // L'échec est tracé dans email_logs sans faire échouer l'appelant : un
    // SMTP en panne ne doit pas faire échouer l'inscription. L'utilisateur
    // peut demander un renvoi depuis son compte. Le revers assumé : il ne
    // saura pas tout de suite que l'email est perdu — mais l'admin le verra
    // dans l'historique.
    const message = error instanceof Error ? error.message : "Erreur inconnue";

    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: "FAILED", error: message.slice(0, 1000) },
    });

    console.error("[mail] envoi échoué :", error);
  }
}

function appUrl(): string {
  return serverEnv().NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_APP_URL!
    : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Gabarit HTML commun. Style inline : les clients mail ignorent le CSS externe. */
function layout(title: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#0a0a0f;font-family:-apple-system,Segoe UI,sans-serif;">
    <table role="presentation" style="max-width:480px;margin:0 auto;background:#12121a;border-radius:16px;border:1px solid #27272a;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:18px;font-weight:600;color:#fff;">astra</p>
          <h1 style="margin:0 0 16px;font-size:20px;color:#fff;">${title}</h1>
          <div style="font-size:14px;line-height:1.6;color:#a1a1aa;">${body}</div>
          ${
            cta
              ? `<p style="margin:24px 0 0;">
                   <a href="${cta.url}" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:500;">${cta.label}</a>
                 </p>
                 <p style="margin:24px 0 0;font-size:12px;color:#71717a;word-break:break-all;">
                   Si le bouton ne fonctionne pas, copiez ce lien :<br>${cta.url}
                 </p>`
              : ""
          }
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(
  userId: string,
  to: string,
  username: string,
  token: string
): Promise<void> {
  const url = `${appUrl()}/verify-email?token=${token}`;

  await send({
    userId,
    to,
    type: "EMAIL_VERIFICATION",
    subject: "Confirmez votre adresse email",
    html: layout(
      `Bienvenue, ${username}`,
      "<p>Il ne reste qu'à confirmer votre adresse pour activer votre compte. Ce lien expire dans 24 heures.</p>",
      { label: "Confirmer mon adresse", url }
    ),
    text: `Bienvenue ${username},\n\nConfirmez votre adresse email en ouvrant ce lien (valable 24 h) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`,
  });
}

export async function sendPasswordResetEmail(
  userId: string,
  to: string,
  username: string,
  token: string
): Promise<void> {
  const url = `${appUrl()}/reset-password?token=${token}`;

  await send({
    userId,
    to,
    type: "PASSWORD_RESET",
    subject: "Réinitialisation de votre mot de passe",
    html: layout(
      "Réinitialisation du mot de passe",
      `<p>Bonjour ${username}, vous avez demandé à réinitialiser votre mot de passe. Ce lien expire dans 30 minutes.</p>
       <p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.</p>`,
      { label: "Choisir un nouveau mot de passe", url }
    ),
    text: `Bonjour ${username},\n\nPour réinitialiser votre mot de passe, ouvrez ce lien (valable 30 minutes) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.`,
  });
}

/**
 * Notifie un changement de mot de passe.
 *
 * Cet email n'est pas une politesse : c'est le signal qui permet à quelqu'un
 * dont le compte a été compromis de s'en apercevoir. Il est envoyé après
 * coup, sans action requise.
 */
export async function sendPasswordChangedEmail(
  userId: string,
  to: string,
  username: string
): Promise<void> {
  await send({
    userId,
    to,
    type: "PASSWORD_CHANGED",
    subject: "Votre mot de passe a été modifié",
    html: layout(
      "Mot de passe modifié",
      `<p>Bonjour ${username}, le mot de passe de votre compte vient d'être changé et toutes vos sessions ont été fermées.</p>
       <p><strong>Si vous n'êtes pas à l'origine de ce changement</strong>, votre compte est compromis : réinitialisez immédiatement votre mot de passe et contactez le support.</p>`
    ),
    text: `Bonjour ${username},\n\nLe mot de passe de votre compte vient d'être changé et toutes vos sessions ont été fermées.\n\nSi vous n'êtes pas à l'origine de ce changement, votre compte est compromis : réinitialisez immédiatement votre mot de passe et contactez le support.`,
  });
}

/** Échappe le HTML d'un texte libre (motif de suspension, saisi par un admin). */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/**
 * Notifie le propriétaire d'une page qu'elle a été suspendue par la
 * modération. Le but de la suspension est qu'il corrige le problème : le
 * mail explique que la page reste modifiable et reviendra automatiquement.
 */
export async function sendSuspensionEmail(
  userId: string,
  to: string,
  username: string,
  slug: string,
  reason: string,
  until: Date | null
): Promise<void> {
  const untilLabel = until
    ? `le ${until.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "jusqu'à nouvel ordre";
  const escapedReason = escapeHtml(reason);

  await send({
    userId,
    to,
    type: "ACCOUNT_SUSPENDED",
    subject: "Votre page a été suspendue",
    html: layout(
      "Page suspendue",
      `<p>Bonjour ${username}, votre page <strong>astra.is-a.dev/${slug}</strong> a été suspendue temporairement par la modération.</p>
       <p><strong>Motif :</strong> ${escapedReason}</p>
       <p>La page est suspendue ${untilLabel}. Vous pouvez toujours modifier son contenu depuis votre espace pour corriger le problème ; elle réapparaîtra automatiquement à la fin de la suspension.</p>`,
      { label: "Modifier ma page", url: `${appUrl()}/panel` }
    ),
    text: `Bonjour ${username},\n\nVotre page astra.is-a.dev/${slug} a été suspendue temporairement par la modération.\n\nMotif : ${reason}\n\nLa page est suspendue ${untilLabel}. Vous pouvez toujours modifier son contenu depuis votre espace pour corriger le problème ; elle réapparaîtra automatiquement à la fin de la suspension.\n\n${appUrl()}/panel`,
  });
}

/**
 * Notifie le propriétaire que la suspension de sa page a été levée avant
 * son terme. La page est de nouveau publique et il a retrouvé le contrôle
 * de la publication.
 */
export async function sendUnsuspensionEmail(
  userId: string,
  to: string,
  username: string,
  slug: string
): Promise<void> {
  await send({
    userId,
    to,
    type: "ACCOUNT_UNSUSPENDED",
    subject: "La suspension de votre page a été levée",
    html: layout(
      "Suspension levée",
      `<p>Bonjour ${username}, la suspension de votre page <strong>astra.is-a.dev/${slug}</strong> a été levée par la modération.</p>
       <p>Votre page est de nouveau en ligne et vous avez retrouvé le contrôle de sa publication.</p>`,
      { label: "Voir ma page", url: `${appUrl()}/${slug}` }
    ),
    text: `Bonjour ${username},\n\nLa suspension de votre page astra.is-a.dev/${slug} a été levée par la modération.\n\nVotre page est de nouveau en ligne et vous avez retrouvé le contrôle de sa publication.\n\n${appUrl()}/${slug}`,
  });
}

/**
 * Notifie un utilisateur que son compte a été suspendu par un admin :
 * connexion bloquée (sessions révoquées), avec le motif et la durée. Il
 * retrouve son compte automatiquement à la fin de la suspension.
 */
export async function sendAccountSuspendedEmail(
  userId: string,
  to: string,
  username: string,
  reason: string | null,
  until: Date | null
): Promise<void> {
  const untilLabel = until
    ? `le ${until.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "jusqu'à nouvel ordre";
  const escapedReason = reason ? escapeHtml(reason) : null;

  await send({
    userId,
    to,
    type: "ACCOUNT_SUSPENDED",
    subject: "Votre compte a été suspendu",
    html: layout(
      "Compte suspendu",
      `<p>Bonjour ${username}, votre compte Astra a été suspendu temporairement par l'équipe de modération.</p>
       ${escapedReason ? `<p><strong>Motif :</strong> ${escapedReason}</p>` : ""}
       <p>Vous ne pouvez plus vous connecter ${untilLabel}. À l'issue de cette période, votre compte sera de nouveau accessible.</p>
       <p>Si vous pensez qu'il s'agit d'une erreur, contactez le support.</p>`
    ),
    text: `Bonjour ${username},\n\nVotre compte Astra a été suspendu temporairement par l'équipe de modération.\n${reason ? `\nMotif : ${reason}\n` : ""}\nVous ne pouvez plus vous connecter ${untilLabel}. À l'issue de cette période, votre compte sera de nouveau accessible.\n\nSi vous pensez qu'il s'agit d'une erreur, contactez le support.`,
  });
}

/**
 * Notifie un utilisateur que la suspension de son compte a été levée : il
 * peut de nouveau se connecter et utiliser ses pages.
 */
export async function sendAccountUnsuspendedEmail(
  userId: string,
  to: string,
  username: string
): Promise<void> {
  await send({
    userId,
    to,
    type: "ACCOUNT_UNSUSPENDED",
    subject: "Votre compte est de nouveau actif",
    html: layout(
      "Suspension levée",
      `<p>Bonjour ${username}, la suspension de votre compte Astra a été levée.</p>
       <p>Vous pouvez de nouveau vous connecter et utiliser vos pages normalement.</p>`,
      { label: "Se connecter", url: `${appUrl()}/login` }
    ),
    text: `Bonjour ${username},\n\nLa suspension de votre compte Astra a été levée.\n\nVous pouvez de nouveau vous connecter et utiliser vos pages normalement.\n\n${appUrl()}/login`,
  });
}

/** Notifie l'activation ou la désactivation de la 2FA. */
export async function sendTwoFactorChangedEmail(
  userId: string,
  to: string,
  username: string,
  enabled: boolean
): Promise<void> {
  const action = enabled ? "activée" : "désactivée";

  await send({
    userId,
    to,
    type: "TWO_FACTOR_CHANGED",
    subject: `Double authentification ${action}`,
    html: layout(
      `Double authentification ${action}`,
      `<p>Bonjour ${username}, la double authentification de votre compte a été ${action}.</p>
       <p><strong>Si vous n'êtes pas à l'origine de ce changement</strong>, votre compte est compromis : changez votre mot de passe immédiatement.</p>`
    ),
    text: `Bonjour ${username},\n\nLa double authentification de votre compte a été ${action}.\n\nSi vous n'êtes pas à l'origine de ce changement, changez votre mot de passe immédiatement.`,
  });
}
