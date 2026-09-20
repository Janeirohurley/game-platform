import { Button } from "react-email";

interface GameArenaEmailButtonProps {
  href: string;
  children: string;
}

export function GameArenaEmailButton({
  href,
  children,
}: GameArenaEmailButtonProps) {
  return (
    <Button href={href} style={styles.button}>
      {children}
    </Button>
  );
}

const styles = {
  button: {
    display: "inline-block",
    padding: "13px 20px",
    backgroundColor: "#0085c2",
    color: "#ffffff",
    fontSize: "14px",
    lineHeight: "20px",
    fontWeight: 600,
    textDecoration: "none",
    borderRadius: "8px",
  },
};