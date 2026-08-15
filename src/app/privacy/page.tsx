import type { Metadata } from "next";
import {
  LegalIntro,
  LegalList,
  LegalP,
  LegalSection,
  LegalShell,
  LegalTitle,
} from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité d'Astra : données collectées, finalités, conservation, droits.",
};

/**
 * Politique de confidentialité d'Astra.
 *
 * Rédigée à partir du fonctionnement réel du service (schéma de base de
 * données, authentification, statistiques, signalements, emails). Chaque
 * catégorie de données listée correspond à une donnée réellement collectée
 * par le code ; rien n'est inventé.
 */
export default function PrivacyPage() {
  return (
    <LegalShell>
      <div className="flex flex-col gap-2 pt-8">
        <LegalTitle>Politique de confidentialité</LegalTitle>
        <LegalIntro>
          Dernière mise à jour : 15 août 2026. Astra est un service gratuit de création de
          pages « biolink ». Cette politique décrit les données personnelles réellement
          traitées par le service, leurs finalités, leur conservation et vos droits.
        </LegalIntro>
      </div>

      <LegalSection title="1. Responsable du traitement">
        <LegalP>
          Le responsable du traitement est l&apos;éditeur du service, une personne physique
          éditrice à titre non professionnel. Conformément à l&apos;article 6-III de la LCEN,
          son identité n&apos;est pas rendue publique ; ses coordonnées d&apos;identification
          réelles ont été communiquées à l&apos;hébergeur.
        </LegalP>
        <LegalP>
          Contact :{" "}
          <a
            href="mailto:contact@astra.is-a.dev"
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            contact@astra.is-a.dev
          </a>
        </LegalP>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <LegalP>
          <strong className="font-medium text-content-primary">Compte.</strong> À
          l&apos;inscription : votre pseudo, votre adresse e-mail et un mot de passe (stocké
          sous forme de hachage, jamais en clair). Sont également conservés le rôle et le
          statut du compte, la date de création et la date de dernière connexion.
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">Authentification.</strong> Des
          cookies de session (techniques, httpOnly) permettant de rester connecté, ainsi
          que l&apos;adresse IP, le type de navigateur et le type d&apos;appareil associés à vos
          sessions. Les échecs de connexion sont comptés temporairement (en cache) afin de
          déclencher un captcha de sécurité après plusieurs tentatives.
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">
            Double authentification (optionnelle).
          </strong>{" "}
          Si vous l&apos;activez : un secret TOTP (chiffré) et des codes de secours à usage
          unique (stockés hachés).
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">
            Liaison Discord (optionnelle).
          </strong>{" "}
          Si vous liez votre compte Discord via OAuth : votre identifiant Discord, votre
          pseudo, votre avatar et, le cas échéant, votre bannière de profil — récupérés
          auprès de Discord sur votre action expresse.
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">Contenu publié.</strong> Vos
          pages (adresse, titre, description, liens, blocs, réglages visuels), ainsi que,
          si vous l&apos;activez, un mot de passe de page (haché).
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">Médias.</strong> Les fichiers
          que vous uploadez (avatar, bannière, musique, curseur, arrière-plan, police),
          avec leur type, leur taille et leur format.
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">Statistiques.</strong> Pour
          chaque page : nombre de vues (totales et uniques), clics sur vos liens, provenance
          (site de référence) et, de façon agrégée, pays approximatif et type d&apos;appareil.
          Pour le comptage des vues uniques, votre navigateur génère un identifiant
          aléatoire conservé en stockage local et stocké haché côté serveur pendant 24
          heures.
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">Signalements.</strong> Si vous
          signalez une page : la raison choisie, un commentaire facultatif, la date, et
          l&apos;identifiant de votre compte si vous êtes connecté (le signalement reste
          possible sans compte).
        </LegalP>
        <LegalP>
          <strong className="font-medium text-content-primary">Emails envoyés.</strong> Un
          historique technique de chaque email transmis (adresse du destinataire, sujet,
          type, statut) est conservé à des fins de traçabilité.
        </LegalP>
        <LegalP>
          Astra ne collecte <strong className="font-medium text-content-primary">aucune</strong>{" "}
          donnée de paiement (le service est gratuit), n&apos;utilise pas de publicité et ne
          pratique aucun profilage publicitaire.
        </LegalP>
      </LegalSection>

      <LegalSection title="3. Finalités et bases légales">
        <LegalList
          items={[
            <>
              <strong className="font-medium text-content-primary">Fournir le service</strong>{" "}
              (création et gestion du compte et des pages, hébergement et affichage du
              contenu) — exécution du contrat conclu lors de votre inscription.
            </>,
            <>
              <strong className="font-medium text-content-primary">Sécurité et prévention des
              abus</strong> (authentification, double authentification, captcha après échecs
              répétés, limitation de débit, surveillance des signalements) — intérêt légitime
              de l&apos;éditeur.
            </>,
            <>
              <strong className="font-medium text-content-primary">Statistiques de vos
              pages</strong> (compteur de vues, clics, provenance) — intérêt légitime de
              l&apos;éditeur et des utilisateurs du service.
            </>,
            <>
              <strong className="font-medium text-content-primary">Traitement des
              signalements et modération</strong> — intérêt légitime et, le cas échéant,
              obligation légale.
            </>,
            <>
              <strong className="font-medium text-content-primary">Emails transactionnels</strong>{" "}
              (vérification d&apos;adresse, réinitialisation de mot de passe, notifications) —
              exécution du contrat et intérêt légitime.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Durée de conservation">
        <LegalList
          items={[
            "Compte et contenu publié : tant que votre compte existe ; suppression possible à tout moment depuis les réglages du compte.",
            "Sessions : 30 jours maximum, ou à la fermeture du navigateur si l'option « Se souvenir de moi » n'est pas cochée.",
            "Empreintes de vues uniques : 24 heures.",
            "Jetons de vérification : 24 heures (vérification d'e-mail) ou 30 minutes (réinitialisation de mot de passe).",
            "Historique des emails : conservé à des fins de traçabilité technique.",
            "En cas de suppression du compte, vos pages, liens, médias et statistiques sont effacés. Certaines traces peuvent être conservées lorsque la loi l'exige.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Stockage et prestataires">
        <LegalP>Les données sont traitées par les prestataires suivants, dans le cadre de leur propre conformité RGPD :</LegalP>
        <LegalList
          items={[
            <>
              <strong className="font-medium text-content-primary">Vercel Inc.</strong>{" "}
              (États-Unis) — hébergement de l&apos;application.
            </>,
            <>
              <strong className="font-medium text-content-primary">Neon</strong> — base de
              données PostgreSQL (stockage des données).
            </>,
            <>
              <strong className="font-medium text-content-primary">Backblaze B2</strong> —
              stockage des fichiers médias (stockage objet compatible S3).
            </>,
            <>
              <strong className="font-medium text-content-primary">Cloudflare, Inc.</strong>{" "}
              — diffusion en cache des médias (domaine média) et captcha de sécurité en cas
              d&apos;échecs de connexion répétés.
            </>,
            <>
              <strong className="font-medium text-content-primary">Mailjet</strong> — envoi des
              emails transactionnels.
            </>,
            <>
              <strong className="font-medium text-content-primary">Discord Inc.</strong> — flux
              de connexion OAuth (liaison de compte), uniquement si vous liez votre compte.
            </>,
            <>
              Service de cache <strong className="font-medium text-content-primary">Redis</strong>{" "}
              (cache des pages publiques, limitation de débit) — instance tierce selon le
              déploiement.
            </>,
          ]}
        />
        <LegalP>
          Ces prestataires n&apos;utilisent pas vos données pour leurs propres finalités
          publicitaires dans le cadre du présent service.
        </LegalP>
      </LegalSection>

      <LegalSection title="6. Transferts hors de l'Union européenne">
        <LegalP>
          Certains prestataires (notamment Vercel, Backblaze et Cloudflare, établis aux
          États-Unis) peuvent impliquer des transferts de données hors de l&apos;Union
          européenne. Ces transferts sont encadrés par les garanties prévues par le RGPD :
          clauses contractuelles types adoptées par la Commission européenne, ou cadre de
          protection des données UE–États-Unis lorsque le prestataire y est certifié.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. Sécurité">
        <LegalP>Le service met en œuvre des mesures techniques et organisationnelles appropriées :</LegalP>
        <LegalList
          items={[
            "Mots de passe stockés en hachage (argon2) et jetons de session stockés hachés.",
            "Cookies de session httpOnly et SameSite, sessions révocables à distance.",
            "Secrets de double authentification chiffrés.",
            "Chiffrement en transit (HTTPS) sur l'ensemble du service.",
            "Limitation de débit et captcha contre les abus.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Vos droits">
        <LegalP>Conformément au RGPD, vous disposez des droits suivants :</LegalP>
        <LegalList
          items={[
            "Accès : obtenir une copie de vos données.",
            "Rectification : corriger votre pseudo, votre e-mail ou tout autre donnée inexacte.",
            "Effacement : supprimer votre compte et vos données.",
            "Limitation du traitement et opposition, dans les cas prévus par la loi.",
            "Portabilité : télécharger vos données au format JSON depuis « Réglages → Mes données → Exporter ».",
          ]}
        />
        <LegalP>
          Vous pouvez supprimer votre compte depuis les réglages du compte (« Supprimer mon
          compte ») : vos pages, liens, médias et statistiques sont alors effacés. Pour
          exercer tout autre droit, écrivez à{" "}
          <a
            href="mailto:contact@astra.is-a.dev"
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            contact@astra.is-a.dev
          </a>
          ; une réponse vous sera apportée dans un délai raisonnable. Si vous estimez que
          vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de
          la CNIL (www.cnil.fr).
        </LegalP>
      </LegalSection>

      <LegalSection title="9. Cookies et traceurs">
        <LegalP>
          Astra n&apos;utilise <strong className="font-medium text-content-primary">aucun cookie
          publicitaire ni traceur tiers</strong>. Seuls sont en place :
        </LegalP>
        <LegalList
          items={[
            <>
              Des <strong className="font-medium text-content-primary">cookies de session
              strictement nécessaires</strong> à la connexion (astra_at, astra_rt), déposés
              uniquement si vous vous connectez — ils relèvent de l&apos;exemption des cookies
              indispensables au service demandé.
            </>,
            <>
              Un <strong className="font-medium text-content-primary">identifiant
              aléatoire</strong> stocké dans le stockage local de votre navigateur
              (localStorage), utilisé exclusivement pour compter les vues uniques de chaque
              page. Il est propre au service, anonyme (il ne désigne qu&apos;un navigateur, pas
              une personne) et n&apos;est communiqué à aucun tiers.
            </>,
          ]}
        />
        <LegalP>
          Aucun bandeau de consentement n&apos;est donc nécessaire ; aucun cookie n&apos;est utilisé
          à des fins de publicité, de mesure d&apos;audience externe ou de profilage.
        </LegalP>
      </LegalSection>

      <LegalSection title="10. Modifications">
        <LegalP>
          Cette politique peut évoluer avec le service. La date de dernière mise à jour
          figure en tête de page ; en cas de changement substantiel, vous en serez informé
          de manière visible avant son entrée en vigueur.
        </LegalP>
      </LegalSection>
    </LegalShell>
  );
}
