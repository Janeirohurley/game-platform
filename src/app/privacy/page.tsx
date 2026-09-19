import type { Metadata } from "next";

import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Game Arena collects, uses and protects personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Game Arena"
      title="Privacy Policy"
      description="This policy explains what information Game Arena may collect, why we use it, and the choices available to you."
      lastUpdated="September 19, 2026"
    >
      <section>
        <h2>1. Overview</h2>

        <p>
          Game Arena is designed around multiplayer gaming. To provide
          accounts, matchmaking, realtime games and community features, we
          need to process certain information about users and their activity.
        </p>

        <p>
          This Privacy Policy explains the categories of information we may
          collect and how that information is handled.
        </p>
      </section>

      <section>
        <h2>2. Information you provide</h2>

        <p>Depending on the features you use, we may collect:</p>

        <ul>
          <li>username and profile information;</li>
          <li>email address;</li>
          <li>authentication credentials or authentication identifiers;</li>
          <li>profile preferences;</li>
          <li>information you voluntarily publish in the community.</li>
        </ul>
      </section>

      <section>
        <h2>3. Game and activity information</h2>

        <p>
          When you use Game Arena, we may process information related to your
          use of the service, such as:
        </p>

        <ul>
          <li>games you join;</li>
          <li>matchmaking activity;</li>
          <li>match results and game state;</li>
          <li>community participation;</li>
          <li>basic account activity and session information.</li>
        </ul>
      </section>

      <section>
        <h2>4. Technical information</h2>

        <p>
          We may collect technical information needed to operate, secure and
          troubleshoot the service, including:
        </p>

        <ul>
          <li>IP address;</li>
          <li>browser and device information;</li>
          <li>operating system information;</li>
          <li>connection and diagnostic information;</li>
          <li>security and error logs.</li>
        </ul>
      </section>

      <section>
        <h2>5. How we use information</h2>

        <p>We may use information to:</p>

        <ul>
          <li>create and manage user accounts;</li>
          <li>authenticate users;</li>
          <li>provide matchmaking and realtime multiplayer features;</li>
          <li>display public profiles and community activity;</li>
          <li>maintain platform security;</li>
          <li>identify bugs, failures and performance problems;</li>
          <li>improve the platform and its features;</li>
          <li>respond to support requests;</li>
          <li>comply with applicable legal obligations.</li>
        </ul>
      </section>

      <section>
        <h2>6. Matchmaking and realtime data</h2>

        <p>
          Multiplayer features require certain information to be processed in
          realtime. For example, matchmaking may use your selected game,
          availability and relevant session information to find compatible
          players.
        </p>

        <p>
          Information necessary for a match may be temporarily processed or
          transmitted between the systems responsible for providing the game.
        </p>
      </section>

      <section>
        <h2>7. Information visible to other users</h2>

        <p>
          Some information is intentionally public when you participate in
          community features. Depending on the product configuration, this may
          include your username, avatar, selected games, online status, match
          activity and community participation.
        </p>

        <p>
          Avoid publishing sensitive or private information in public profile
          fields, chats or other community areas.
        </p>
      </section>

      <section>
        <h2>8. Cookies and local storage</h2>

        <p>
          Game Arena may use browser storage technologies, including cookies or
          local storage, to keep users signed in, remember preferences,
          maintain security information and provide application functionality.
        </p>

        <p>
          The exact technologies used may change as the platform evolves.
        </p>
      </section>

      <section>
        <h2>9. Sharing information</h2>

        <p>
          We do not treat your information as public simply because you have
          an account. Information may be shared with service providers only
          when necessary to operate, secure or improve the platform, or when
          required by law.
        </p>

        <p>
          The production version of this policy should identify the categories
          of external providers used by Game Arena, such as hosting,
          authentication, analytics or communication services.
        </p>
      </section>

      <section>
        <h2>10. Data retention</h2>

        <p>
          We retain information for as long as reasonably necessary to provide
          the service, maintain security, resolve disputes, enforce platform
          rules and satisfy applicable legal requirements.
        </p>

        <p>
          Retention periods may differ depending on the type of information
          and the reason it was collected.
        </p>
      </section>

      <section>
        <h2>11. Security</h2>

        <p>
          We use reasonable technical and organizational measures intended to
          protect information against unauthorized access, alteration, loss or
          disclosure.
        </p>

        <p>
          No internet service can guarantee absolute security, so users should
          also protect their account credentials and devices.
        </p>
      </section>

      <section>
        <h2>12. Your privacy choices</h2>

        <p>
          Depending on your location and applicable law, you may have rights
          concerning your personal information, including rights to access,
          correct, delete or otherwise control certain information.
        </p>

        <p>
          To exercise an applicable privacy right, use the official support or
          privacy contact channel provided by Game Arena.
        </p>
      </section>

      <section>
        <h2>13. Children</h2>

        <p>
          Game Arena is not intended to knowingly collect personal information
          from children in violation of applicable law.
        </p>

        <p>
          If you believe that a child has provided personal information without
          appropriate authorization, contact the platform through its official
          support channel.
        </p>
      </section>

      <section>
        <h2>14. International processing</h2>

        <p>
          Depending on the infrastructure used to operate Game Arena,
          information may be processed in countries other than the country
          where you live.
        </p>

        <p>
          The final production policy should identify the relevant countries,
          safeguards and legal mechanisms where required by applicable law.
        </p>
      </section>

      <section>
        <h2>15. Changes to this policy</h2>

        <p>
          We may update this Privacy Policy when our services, infrastructure
          or legal obligations change.
        </p>

        <p>
          The updated version will replace the previous version once it becomes
          effective.
        </p>
      </section>

      <section>
        <h2>16. Contact</h2>

        <p>
          Questions about privacy, data access or deletion should be sent
          through the official privacy or support channel provided by Game
          Arena.
        </p>

        <p>
          Before publishing the production version, add the legal entity name,
          official privacy contact and any required regulatory information.
        </p>
      </section>
    </LegalPage>
  );
}