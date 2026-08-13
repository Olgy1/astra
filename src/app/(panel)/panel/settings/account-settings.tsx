"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PasswordStrength } from "@/components/ui/password-strength";

type Props = {
  user: {
    username: string;
    email: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    discordLinked: boolean;
  };
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface-1 p-6">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function AccountSettings({ user }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <ProfileSection user={user} />
      <DiscordSection linked={user.discordLinked} />
      <PasswordSection />
      <TwoFactorSection enabled={user.twoFactorEnabled} />
      <DataSection />
      <DangerSection hasPassword={!user.discordLinked || true} />
    </div>
  );
}

function DiscordSection({ linked }: { linked: boolean }) {
  const [isLinked, setIsLinked] = useState(linked);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function unlink() {
    setLoading(true);
    setError(null);
    const result = await api.delete("/api/auth/discord");
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setIsLinked(false);
  }

  return (
    <Section title="Compte Discord">
      <div className="flex flex-col gap-3">
        {error && <Alert tone="danger">{error}</Alert>}
        {isLinked ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-content-secondary">
              Discord est lié. Votre présence peut s&apos;afficher en direct sur votre page.
            </p>
            <Button variant="secondary" size="sm" loading={loading} onClick={unlink}>
              Délier
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-content-secondary">
              Liez Discord pour afficher votre statut et votre activité en temps réel.
            </p>
            {/* Lien et non fetch : le flux OAuth est une navigation. */}
            <a
              href="/api/auth/discord"
              className="flex items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
                <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.197.373.291a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.893.077.077 0 0 0-.041.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Lier Discord
            </a>
          </div>
        )}
      </div>
    </Section>
  );
}

function ProfileSection({ user }: Props) {
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setFields({});

    const patch: Record<string, string> = {};
    if (username !== user.username) patch.username = username;
    if (email !== user.email) patch.email = email;

    if (Object.keys(patch).length === 0) {
      setLoading(false);
      return;
    }

    const result = await api.patch<{ message: string }>("/api/me", patch);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    setMessage(result.data.message);
  }

  return (
    <Section title="Profil">
      <div className="flex flex-col gap-3">
        {message && <Alert tone="success">{message}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Pseudo" value={username} onChange={(e) => setUsername(e.target.value)} errors={fields.username} autoCapitalize="none" />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errors={fields.email}
          hint={user.emailVerified ? "Confirmée." : "Non confirmée."}
          autoCapitalize="none"
        />
        <Button size="sm" loading={loading} onClick={save} disabled={username === user.username && email === user.email}>
          Enregistrer
        </Button>
      </div>
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setFields({});

    const result = await api.post<{ message: string }>("/api/auth/password/change", {
      currentPassword: current,
      newPassword: next,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setFields(result.fields ?? {});
      return;
    }
    setMessage(result.data.message);
    setCurrent("");
    setNext("");
  }

  return (
    <Section title="Mot de passe">
      <div className="flex flex-col gap-3">
        {message && <Alert tone="success">{message}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Mot de passe actuel" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} errors={fields.currentPassword} autoComplete="current-password" />
        <div className="flex flex-col gap-2">
          <Input label="Nouveau mot de passe" type="password" value={next} onChange={(e) => setNext(e.target.value)} errors={fields.newPassword} autoComplete="new-password" />
          <PasswordStrength password={next} />
        </div>
        <Button size="sm" loading={loading} onClick={save} disabled={!current || !next}>
          Changer le mot de passe
        </Button>
      </div>
    </Section>
  );
}

function TwoFactorSection({ enabled }: { enabled: boolean }) {
  const [active, setActive] = useState(enabled);
  const [setup, setSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function begin() {
    setLoading(true);
    setError(null);
    const result = await api.post<{ secret: string; qrCodeDataUrl: string }>("/api/auth/2fa/setup");
    setLoading(false);
    if (result.ok) setSetup(result.data);
    else setError(result.message);
  }

  async function confirm() {
    setLoading(true);
    setError(null);
    const result = await api.post<{ backupCodes: string[] }>("/api/auth/2fa/enable", { secret: setup!.secret, code });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setBackupCodes(result.data.backupCodes);
    setActive(true);
    setSetup(null);
    setCode("");
  }

  async function disable() {
    setLoading(true);
    setError(null);
    const result = await api.post("/api/auth/2fa/disable", { password });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setActive(false);
    setPassword("");
  }

  return (
    <Section title="Double authentification">
      <div className="flex flex-col gap-3">
        {error && <Alert tone="danger">{error}</Alert>}

        {backupCodes && (
          <Alert tone="warning">
            <p className="font-medium">Vos codes de secours — notez-les maintenant, ils ne seront plus affichés :</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-xs">
              {backupCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </Alert>
        )}

        {active ? (
          <>
            <p className="text-sm text-content-secondary">La double authentification est active.</p>
            {!backupCodes && (
              <div className="flex flex-col gap-2">
                <Input label="Mot de passe (pour désactiver)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <Button variant="danger" size="sm" loading={loading} onClick={disable} disabled={!password}>
                  Désactiver
                </Button>
              </div>
            )}
          </>
        ) : setup ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-content-secondary">Scannez ce QR code avec votre application d&apos;authentification.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrCodeDataUrl} alt="QR code de configuration 2FA" className="rounded-lg" width={200} height={200} />
            <Input label="Code à 6 chiffres" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" />
            <Button size="sm" loading={loading} onClick={confirm} disabled={code.length !== 6} fullWidth>
              Activer
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-content-secondary">Ajoutez une couche de sécurité à votre compte.</p>
            <Button variant="secondary" size="sm" loading={loading} onClick={begin}>
              Activer
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}

function DataSection() {
  return (
    <Section title="Mes données">
      <div className="flex items-center justify-between">
        <p className="text-sm text-content-secondary">Téléchargez une copie de toutes vos données (RGPD).</p>
        {/* Lien direct : l'endpoint renvoie le fichier avec Content-Disposition. */}
        <a href="/api/me/export" className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-3">
          Exporter
        </a>
      </div>
    </Section>
  );
}

function DangerSection({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function remove() {
    setLoading(true);
    setError(null);
    const result = await api.delete("/api/me", { password, confirm });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <section className="rounded-2xl border border-danger/30 bg-danger/5 p-6">
      <h2 className="mb-1 text-sm font-semibold text-danger">Supprimer mon compte</h2>
      <p className="mb-4 text-sm text-content-secondary">
        Cette action est définitive. Votre page, vos liens, vos médias et toutes vos statistiques seront effacés.
      </p>

      {open ? (
        <div className="flex flex-col gap-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {hasPassword && (
            <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          )}
          <Input label={'Tapez "SUPPRIMER" pour confirmer'} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="danger" size="sm" loading={loading} onClick={remove} disabled={confirm !== "SUPPRIMER" || (hasPassword && !password)}>
              Supprimer définitivement
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      )}
    </section>
  );
}
