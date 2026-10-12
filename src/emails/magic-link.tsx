import { Heading, Link, Section, Text } from "react-email";

import { GameArenaEmailLayout } from "./components/game-arena-email-layout";
import { GameArenaEmailButton } from "./components/game-arena-email-button";

interface MagicLinkEmailProps {
  url: string;
  /** Present on first registration only. */
  username?: string;
}

export function MagicLinkEmail({ url, username }: MagicLinkEmailProps) {
  return (
    <GameArenaEmailLayout
      lang="fr"
      preview="Ton lien de connexion à Game Arena — valable 10 minutes."
      footerText="Tu reçois cet e-mail car une connexion à Game Arena a été demandée pour cette adresse."
    >
      <Heading style={styles.heading}>Connexion à Game Arena</Heading>

      <Text style={styles.text}>
        {username ? `Bonjour ${username},` : "Bonjour,"}
      </Text>

      <Text style={styles.text}>
        Clique sur le bouton ci-dessous pour te connecter à Game Arena. Ton
        compte sera créé automatiquement si tu n&apos;en as pas encore.
      </Text>

      <Section style={styles.buttonSection}>
        <GameArenaEmailButton href={url}>Me connecter</GameArenaEmailButton>
      </Section>

      <Text style={styles.helper}>
        Si le bouton ne fonctionne pas, copie et colle ce lien dans ton
        navigateur :
      </Text>

      <Link href={url} style={styles.link}>
        {url}
      </Link>

      <Section style={styles.notice}>
        <Text style={styles.noticeTitle}>
          Ce lien expire dans 10 minutes
        </Text>

        <Text style={styles.noticeText}>
          Il ne peut être utilisé qu&apos;une seule fois.
        </Text>
      </Section>

      <Text style={styles.noticeText}>
        Si tu n&apos;es pas à l&apos;origine de cette demande, tu peux ignorer
        cet e-mail : aucun accès ne sera donné sans un clic sur le lien.
      </Text>

      <Text style={styles.signature}>— L&apos;équipe Game Arena</Text>
    </GameArenaEmailLayout>
  );
}

const styles = {
  heading: {
    margin: "0 0 20px",
    fontSize: "24px",
    lineHeight: "32px",
    fontWeight: 600,
    color: "#0f172a",
  },

  text: {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: "24px",
    color: "#334155",
  },

  buttonSection: {
    margin: "28px 0",
  },

  helper: {
    margin: "28px 0 8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "#64748b",
  },

  link: {
    margin: "0 0 28px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "#0085c2",
    wordBreak: "break-all" as const,
  },

  notice: {
    margin: "0 0 20px",
    padding: "16px 18px",
    backgroundColor: "#f1f5f9",
    borderLeft: "3px solid #0085c2",
  },

  noticeTitle: {
    margin: "0 0 4px",
    fontSize: "13px",
    lineHeight: "20px",
    fontWeight: 600,
    color: "#0f172a",
  },

  noticeText: {
    margin: "0",
    fontSize: "13px",
    lineHeight: "20px",
    color: "#64748b",
  },

  signature: {
    margin: "24px 0 0",
    fontSize: "14px",
    lineHeight: "22px",
    color: "#334155",
  },
};
