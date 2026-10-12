import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

interface GameArenaEmailLayoutProps {
  preview: string;
  children: ReactNode;
  footerText?: string;
  lang?: string;
}

export function GameArenaEmailLayout({
  preview,
  children,
  footerText = "You are receiving this email because you have a Game Arena account.",
  lang = "en",
}: GameArenaEmailLayoutProps) {
  return (
    <Html lang={lang}>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTcviYwY.woff2",
            format: "woff2",
          }}
          fontWeight={400}
        />

        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTcviYwY.woff2",
            format: "woff2",
          }}
          fontWeight={600}
        />
      </Head>

      <Preview>{preview}</Preview>

      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brand}>
              <span style={styles.brandAccent}>GAME</span> ARENA
            </Text>
          </Section>

          <Section style={styles.content}>{children}</Section>

          <Hr style={styles.separator} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>{footerText}</Text>

            <Text style={styles.footerText}>
              © {new Date().getFullYear()} Game Arena
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    margin: 0,
    padding: "32px 16px",
    backgroundColor: "#f8fafc",
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    color: "#0f172a",
  },

  container: {
    width: "100%",
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  header: {
    padding: "28px 32px 20px",
    borderBottom: "1px solid #e2e8f0",
  },

  brand: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "20px",
    letterSpacing: "0.12em",
    fontWeight: 600,
    color: "#0f172a",
  },

  brandAccent: {
    color: "#0085c2",
  },

  content: {
    padding: "40px 32px 36px",
  },

  separator: {
    margin: 0,
    borderColor: "#e2e8f0",
  },

  footer: {
    padding: "24px 32px 30px",
  },

  footerText: {
    margin: "0 0 6px",
    fontSize: "12px",
    lineHeight: "18px",
    color: "#64748b",
  },
};
