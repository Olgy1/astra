import type { Metadata } from "next";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Créer un mot de passe · Astra",
};

/**
 * Page de création du premier mot de passe, atteinte après une inscription
 * via Discord (le compte n'a pas de mot de passe). Le middleware la laisse
 * accessible aux sessions actives : c'est justement l'utilisateur fraîchement
 * connecté via Discord qu'on attend ici.
 */
export default function SetPasswordPage() {
  return <SetPasswordForm />;
}
