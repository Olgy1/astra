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
  title: "Conditions d'utilisation",
  description:
    "Conditions générales d'utilisation du service Astra (CGU) : compte, contenu, modération, signalements.",
};

/**
 * Conditions générales d'utilisation d'Astra.
 *
 * Rédigées pour un service personnel et gratuit : les clauses restent
 * proportionnées, ne transfèrent pas la propriété des contenus utilisateurs
 * et n'exonèrent pas abusivement le service de toute responsabilité.
 */
export default function TermsPage() {
  return (
    <LegalShell>
      <div className="flex flex-col gap-2 pt-8">
        <LegalTitle>Conditions générales d&apos;utilisation</LegalTitle>
        <LegalIntro>
          Dernière mise à jour : 15 août 2026. En créant un compte ou en utilisant une page
          Astra, vous acceptez les présentes conditions.
        </LegalIntro>
      </div>

      <LegalSection title="1. Objet">
        <LegalP>
          Astra est un service gratuit permettant à toute personne de créer une page
          « biolink » : une page unique regroupant des liens, des réseaux sociaux et des
          médias. Le service est fourni tel quel, sans contrepartie financière.
        </LegalP>
      </LegalSection>

      <LegalSection title="2. Compte">
        <LegalP>
          La création d&apos;un compte vous permet de créer et de gérer vos pages. Vous êtes
          responsable de la confidentialité de vos identifiants et de toute activité
          réalisée depuis votre compte. En cas d&apos;utilisation non autorisée, informez-en
          rapidement le service.
        </LegalP>
        <LegalP>
          Vous pouvez supprimer votre compte à tout moment depuis les réglages du compte ;
          vos pages, liens, médias et statistiques sont alors effacés. Le service peut
          suspendre ou supprimer un compte dans les cas prévus à l&apos;article 5.
        </LegalP>
      </LegalSection>

      <LegalSection title="3. Contenu publié">
        <LegalP>
          Vous restez propriétaire des contenus que vous publiez (textes, images, vidéos,
          sons, liens). En les publiant, vous accordez à Astra la licence limitée nécessaire
          au fonctionnement du service : héberger, stocker et afficher ces contenus sur
          votre page. Cette licence ne transfère pas la propriété de vos contenus et ne
          couvre aucun autre usage.
        </LegalP>
        <LegalP>
          Vous vous engagez à ne pas publier de contenus ou de liens :
        </LegalP>
        <LegalList
          items={[
            "illégaux ou contraires à l'ordre public ;",
            "à caractère sexuellement explicite, ou impliquant des mineurs ;",
            "incitant à la haine, à la discrimination ou à la violence ;",
            "constituant du harcèlement, des menaces ou de l'intimidation ;",
            "usurpant l'identité d'une personne ou d'une entité ;",
            "constituant du spam, du phishing ou de la fraude ;",
            "contenant des logiciels malveillants ou des liens malveillants ;",
            "portant atteinte aux droits d'autrui, notamment au droit d'auteur, à l'image ou à la vie privée ;",
            "dangereux, trompeurs ou destinés à contourner la loi.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Signalement">
        <LegalP>
          Chaque page dispose d&apos;un bouton « Signaler » menant à un formulaire de
          signalement. Tout visiteur peut signaler une page (spam, harcèlement, contenu
          illégal, usurpation, autre), avec un commentaire facultatif. Les signalements sont
          examinés par la modération du service.
        </LegalP>
      </LegalSection>

      <LegalSection title="5. Modération">
        <LegalP>
          Le service peut retirer un contenu, limiter sa visibilité, suspendre ou supprimer
          une page ou un compte lorsque cela est nécessaire au respect des présentes
          conditions, de la loi, à la sécurité du service ou aux droits d&apos;autrui. Une page
          suspendue l&apos;est pour une durée limitée ; son auteur est informé du motif.
        </LegalP>
      </LegalSection>

      <LegalSection title="6. Propriété intellectuelle">
        <LegalP>
          Le logiciel, l&apos;interface, le logo et la marque « Astra » appartiennent à
          l&apos;éditeur du service. Les contenus publiés par les utilisateurs restent la
          propriété de leurs auteurs. Les marques et contenus tiers cités sur les pages
          restent la propriété de leurs titulaires.
        </LegalP>
      </LegalSection>

      <LegalSection title="7. Disponibilité du service">
        <LegalP>
          Le service est gratuit et peut évoluer : des fonctionnalités peuvent être
          modifiées ou supprimées, et des interruptions (maintenance, incident technique)
          peuvent survenir. Astra ne garantit pas une disponibilité absolue et continue du
          service.
        </LegalP>
      </LegalSection>

      <LegalSection title="8. Responsabilité">
        <LegalP>
          Vous êtes responsable des contenus que vous publiez et des conséquences de leur
          publication. Les pages peuvent contenir des liens vers des sites tiers, sur
          lesquels Astra n&apos;a aucun contrôle. Astra s&apos;efforce de maintenir le service
          opérationnel, mais ne peut être tenu responsable des dommages indirects résultant
          d&apos;une interruption, d&apos;une perte de données ou de l&apos;usage qui est fait du
          service, dans les limites prévues par le droit applicable.
        </LegalP>
      </LegalSection>

      <LegalSection title="9. Données personnelles">
        <LegalP>
          Le traitement de vos données personnelles est décrit dans la politique de
          confidentialité du service, qui fait partie intégrante des présentes conditions.
        </LegalP>
      </LegalSection>

      <LegalSection title="10. Droit applicable et contact">
        <LegalP>
          Les présentes conditions sont soumises au droit français. Pour toute question,
          réclamation ou demande relative au service, écrivez à{" "}
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
