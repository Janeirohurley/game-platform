import { Heading, Link, Section, Text } from "react-email";
import { GameArenaEmailLayout } from "./components/game-arena-email-layout";
import { GameArenaEmailButton } from "./components/game-arena-email-button";

interface ResetPasswordProps {
  username: string;
  resetUrl: string;
}

export function ResetPassword({ username, resetUrl }: ResetPasswordProps) {
  return (
    <GameArenaEmailLayout preview="Reset your Game Arena password.">
      <Heading style={styles.heading}>Reset your password</Heading>

      <Text style={styles.text}>Hi {username},</Text>

      <Text style={styles.text}>
        We received a request to reset the password for your Game Arena account.
      </Text>

      <Section style={styles.buttonSection}>
        <GameArenaEmailButton href={resetUrl}>
          Reset password
        </GameArenaEmailButton>
      </Section>

      <Text style={styles.text}>
        For your security, this link should only be used by you. If you did not
        request a password reset, no action is required.
      </Text>

      <Text style={styles.helper}>
        You can also copy and paste this URL into your browser:
      </Text>

      <Link href={resetUrl} style={styles.link}>
        {resetUrl}
      </Link>

      <Section style={styles.securityNotice}>
        <Text style={styles.securityTitle}>Security reminder</Text>

        <Text style={styles.securityText}>
          Game Arena will never ask you to send your password by email or
          message.
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
    margin: "24px 0 8px",
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

  securityNotice: {
    marginTop: "32px",
    padding: "16px",
    borderLeft: "3px solid #0085c2",
    backgroundColor: "#f8fafc",
  },

  securityTitle: {
    margin: "0 0 6px",
    fontSize: "13px",
    lineHeight: "18px",
    fontWeight: 600,
    color: "#334155",
  },

  securityText: {
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
