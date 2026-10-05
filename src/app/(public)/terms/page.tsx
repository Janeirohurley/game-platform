import type { Metadata } from "next";

import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The rules and conditions for using Game Arena.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Game Arena"
      title="Terms of Service"
      description="These terms explain the rules for using Game Arena, joining games, interacting with other players, and accessing the platform."
      lastUpdated="September 19, 2026"
    >
      <section>
        <h2>1. Using Game Arena</h2>

        <p>
          Game Arena is a multiplayer gaming platform that allows users to
          discover public games, find other players and participate in
          realtime matches.
        </p>

        <p>
          By creating an account or using the platform, you agree to follow
          these Terms of Service and the rules presented within individual
          games or communities.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>

        <p>
          You are responsible for keeping your account information accurate
          and for protecting your login credentials.
        </p>

        <p>
          Do not share your password or intentionally allow another person to
          use your account.
        </p>

        <p>
          You are responsible for activity performed through your account
          unless the activity resulted from a security issue that you
          reported to us promptly.
        </p>
      </section>

      <section>
        <h2>3. Community rules</h2>

        <p>Game Arena is intended to be a competitive but respectful space.</p>

        <p>You must not use the platform to:</p>

        <ul>
          <li>harass, threaten or abuse another person;</li>
          <li>impersonate another user or organization;</li>
          <li>spam, scam or deliberately mislead other players;</li>
          <li>share malicious software or harmful links;</li>
          <li>attempt to access another user&apos;s account;</li>
          <li>interfere with the operation of the platform;</li>
          <li>use cheats, exploits, bots or unauthorized automation;</li>
          <li>use the platform for unlawful activities.</li>
        </ul>
      </section>

      <section>
        <h2>4. Fair play</h2>

        <p>
          Realtime games depend on a fair and reliable environment. You must
          not manipulate matchmaking, falsify game results, exploit technical
          vulnerabilities or interfere with another player&apos;s connection.
        </p>

        <p>
          We may investigate suspicious activity and take appropriate action
          when necessary to protect the integrity of the platform and its
          players.
        </p>
      </section>

      <section>
        <h2>5. Public content</h2>

        <p>
          Some information you publish may be visible to other users,
          including your username, profile information, game activity and
          community activity.
        </p>

        <p>
          Do not publish information that you do not want other players to
          see.
        </p>
      </section>

      <section>
        <h2>6. Games and third-party content</h2>

        <p>
          Games available through Game Arena may be developed or provided by
          Game Arena or by third parties.
        </p>

        <p>
          Third-party games may have additional rules, licenses or terms that
          apply to their use.
        </p>
      </section>

      <section>
        <h2>7. Availability</h2>

        <p>
          We work to keep Game Arena available and reliable, but the platform
          may occasionally be unavailable because of maintenance, upgrades,
          technical failures or circumstances outside our control.
        </p>

        <p>
          We may modify, suspend or discontinue parts of the platform when
          reasonably necessary.
        </p>
      </section>

      <section>
        <h2>8. Suspension and termination</h2>

        <p>
          We may restrict, suspend or terminate access to an account when we
          reasonably believe that the account violates these Terms, threatens
          the security of the platform, or causes harm to other users.
        </p>

        <p>
          You may stop using Game Arena at any time and request deletion of
          your account where that functionality is available.
        </p>
      </section>

      <section>
        <h2>9. Intellectual property</h2>

        <p>
          The Game Arena name, branding, interface, software and original
          content are protected by applicable intellectual property laws.
        </p>

        <p>
          You may use the platform for its intended purpose, but you may not
          copy, redistribute, reverse engineer or commercially exploit
          protected parts of the service without authorization.
        </p>
      </section>

      <section>
        <h2>10. Disclaimer</h2>

        <p>
          Game Arena is provided on an as-available basis. To the extent
          permitted by applicable law, we do not guarantee that the service
          will always be uninterrupted, error-free or available on every
          device or network.
        </p>
      </section>

      <section>
        <h2>11. Changes to these terms</h2>

        <p>
          We may update these Terms when the platform, its features or its
          legal requirements change. When changes are significant, we will
          make reasonable efforts to communicate them through the platform.
        </p>

        <p>
          Continued use of Game Arena after updated Terms become effective
          means that you accept the updated Terms, to the extent permitted by
          applicable law.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>

        <p>
          For questions concerning these Terms, use the official support or
          contact channel provided by Game Arena.
        </p>

        <p>
          The final production version of these Terms should identify the
          legal entity operating Game Arena, its official contact information
          and the governing jurisdiction.
        </p>
      </section>
    </LegalPage>
  );
}