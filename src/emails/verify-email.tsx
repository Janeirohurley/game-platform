import { Heading, Link, Section, Text } from "react-email";
import { GameArenaEmailLayout } from "./components/game-arena-email-layout";
import { GameArenaEmailButton } from "./components/game-arena-email-button";

interface VerifyEmailProps {
  username: string;
  verificationUrl: string;
}

export function VerifyEmail({ username, verificationUrl }: VerifyEmailProps) {
  return (
    <GameArenaEmailLayout preview="Verify your email address to finish creating your Game Arena account.">
      <Heading style={styles.heading}>Verify your email</Heading>

      <Text style={styles.text}>Hi {username},</Text>

      <Text style={styles.text}>
        Thanks for joining Game Arena. Before you start playing, verify your
        email address to activate your account.
      </Text>

      <Section style={styles.buttonSection}>
        <GameArenaEmailButton href={verificationUrl}>
          Verify email address
        </GameArenaEmailButton>
      </Section>

      <Text style={styles.helper}>
        If the button does not work, copy and paste this URL into your browser:
      </Text>

      <Link href={verificationUrl} style={styles.link}>
        {verificationUrl}
      </Link>

      <Section style={styles.notice}>
        <Text style={styles.noticeTitle}>Didn't create this account?</Text>

        <Text style={styles.noticeText}>
          You can safely ignore this email. No changes will be made to your
          account.
        </Text>
      </Section>

      <Text style={styles.signature}>— The Game Arena team</Text>
    </GameArenaEmailLayout>
  );
}

const styles = {
  heading: {
    margin: "0 0 24px",
    fontSize: "28px",
    lineHeight: "36px",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },

  text: {
    margin: "0 0 16px",
    fontSize: "15px",
    lineHeight: "24px",
    color: "#334155",
  },

  buttonSection: {
    margin: "30px 0",
  },

  helper: {
    margin: "0 0 8px",
    fontSize: "13px",
    lineHeight: "20px",
    color: "#64748b",
  },

  link: {
    display: "block",
    fontSize: "12px",
    lineHeight: "18px",
    color: "#0085c2",
    wordBreak: "break-all" as const,
    textDecoration: "none",
  },

  notice: {
    marginTop: "32px",
    padding: "16px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
  },

  noticeTitle: {
    margin: "0 0 6px",
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 600,
    color: "#334155",
  },

  noticeText: {
    margin: 0,
    fontSize: "12px",
    lineHeight: "18px",
    color: "#64748b",
  },

  signature: {
    margin: "28px 0 0",
    fontSize: "14px",
    lineHeight: "20px",
    color: "#334155",
  },
};
