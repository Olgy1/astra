import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalIntro,
  LegalList,
  LegalP,
  LegalSection,
  LegalShell,
  LegalTitle,
} from "@/components/legal/legal-shell";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Mentions légales d'Astra, service de création de pages biolink édité à titre non professionnel.",
};

/**
 * Mentions légales d'Astra.
 *
 * Le service est édité par une personne physique, à titre non professionnel.
 * En application de l'article 6-III de la loi n° 2004-575 du 21 juin 2004
 * (LCEN), un éditeur non professionnel peut ne pas rendre publique son
 * identité : les coordonnées réelles de l'éditeur sont communiquées à
 * l'hébergeur, qui seul y a accès dans les conditions prévues par la loi.
 * Aucun nom, prénom ni adresse personnelle n'est donc affiché ici.
 */
export default function LegalPage() {
  return (
    <LegalShell>
      <div className="flex flex-col gap-2 pt-8">
        <LegalTitle>Mentions légales</LegalTitle>
        <LegalIntro>
          Dernière mise à jour : 15 août 2026. Ces mentions décrivent l&apos;édition
          du service <span className="text-content-primary">Astra</span>, accessible à
          l&apos;adresse <span className="font-mono">https://astraa.is-cool.dev</span>.
        </LegalIntro>
      </div>

      <LegalSection title="Éditeur du service">
        <LegalP>
          Astra est un service de création de pages « biolink » (une page unique
          regroupant des liens, des réseaux sociaux et des médias), édité par une{" "}
          <strong className="font-medium text-content-primary">personne physique</strong> à
          titre <strong className="font-medium text-content-primary">non professionnel</strong>,
          sans activité commerciale, sans revenus et sans publicité.
        </LegalP>
        <LegalP>
          Conformément à l&apos;article 6-III de la loi n° 2004-575 du 21 juin 2004 pour la
          confiance dans l&apos;économie numérique (LCEN), l&apos;identité de l&apos;éditeur
          n&apos;est pas rendue publique : ses coordonnées d&apos;identification réelles ont été
          communiquées à l&apos;hébergeur du service, seul habilité à y accéder dans les
          conditions prévues par la loi.
        </LegalP>
        <LegalP>
          Adresse de contact public :{" "}
          <a
            href="mailto:contact@astraa.is-cool.dev"
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            contact@astraa.is-cool.dev
          </a>
        </LegalP>
      </LegalSection>

      <LegalSection title="Hébergeur">
        <LegalP>Le service est hébergé par :</LegalP>
        <LegalList
          items={[
            <>
              <strong className="font-medium text-content-primary">Vercel Inc.</strong>,
              340 S Lemon Ave #4133, Walnut, Californie 91789, États-Unis —{" "}
              <a
                href="https://vercel.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent transition-colors hover:text-accent-hover"
              >
                vercel.com
              </a>
            </>,
            "Base de données : service PostgreSQL Neon.",
            "Stockage des fichiers médias : service Backblaze B2, servi via le CDN Cloudflare.",
          ]}
        />
        <LegalP>
          Pour toute question relative à l&apos;hébergement ou à une notification de contenu
          présumé illicite, adressez-vous à l&apos;éditeur via l&apos;adresse de contact ci-dessus.
        </LegalP>
      </LegalSection>

      <LegalSection title="Directeur de publication">
        <LegalP>
          Le service étant édité à titre non professionnel par une personne physique dont
          l&apos;identité n&apos;est pas rendue publique en application de l&apos;article 6-III de la
          LCEN, les demandes concernant le contenu publié (notamment les demandes de droit
          de réponse ou de retrait) peuvent être adressées à l&apos;éditeur à l&apos;adresse{" "}
          <a
            href="mailto:contact@astraa.is-cool.dev"
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            contact@astraa.is-cool.dev
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection title="Signalement de contenus">
        <LegalP>
          Chaque page publie un bouton « Signaler » qui mène à un formulaire de
          signalement (<span className="font-mono">astraa.is-cool.dev/[adresse]/report</span>).
          Tout visiteur peut signaler une page (spam, harcèlement, contenu illégal,
          usurpation, autre), avec un commentaire facultatif.
        </LegalP>
        <LegalP>
          Les signalements sont examinés par la modération du service. En cas de contenu
          manifestement illicite, la page concernée peut être retirée ou suspendue
          conformément aux{" "}
          <Link href="/terms" className="text-accent transition-colors hover:text-accent-hover">
            conditions d&apos;utilisation
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalSection title="Cookies et traceurs">
        <LegalP>
          Astra n&apos;utilise aucun cookie publicitaire ni traceur tiers. Seuls des cookies
          de session strictement nécessaires au fonctionnement du service (connexion) sont
          déposés, ainsi qu&apos;un identifiant aléatoire stocké localement par votre
          navigateur et utilisé exclusivement au comptage des vues uniques. Aucun bandeau de
          consentement n&apos;est requis à ce titre. Voir la{" "}
          <Link href="/privacy" className="text-accent transition-colors hover:text-accent-hover">
            politique de confidentialité
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <LegalP>
          Le logiciel, l&apos;interface, le logo et la marque « Astra » appartiennent à
          l&apos;éditeur. Les contenus publiés par les utilisateurs (textes, images, vidéos,
          liens) restent la propriété de leurs auteurs, qui accordent à Astra la licence
          limitée nécessaire à leur hébergement et à leur affichage.
        </LegalP>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <LegalP>
          Les traitements de données personnelles sont décrits dans la{" "}
          <Link href="/privacy" className="text-accent transition-colors hover:text-accent-hover">
            politique de confidentialité
          </Link>
          . Pour exercer vos droits (accès, rectification, effacement, portabilité…),
          écrivez à{" "}
          <a
            href="mailto:contact@astraa.is-cool.dev"
            className="font-medium text-accent transition-colors hover:text-accent-hover"
          >
            contact@astraa.is-cool.dev
          </a>
          .
        </LegalP>
      </LegalSection>
    </LegalShell>
  );
}
